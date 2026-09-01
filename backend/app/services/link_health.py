"""HTTP availability checks for workspace links."""

from __future__ import annotations

from datetime import UTC, datetime
from time import perf_counter
from urllib.parse import urlparse
from uuid import UUID

import httpx

from app.core.exceptions import EntityNotFoundError
from app.models.enums import LinkHealthStatus
from app.models.link import Link
from app.repositories.link import LinkRepository


class LinkHealthService:
    timeout = httpx.Timeout(5.0)
    warning_latency_ms = 2500

    def __init__(self, links: LinkRepository) -> None:
        self.links = links

    async def check(self, link_id: UUID, user_id: UUID) -> Link:
        link = await self.links.get_for_owner(link_id, user_id)
        if link is None:
            raise EntityNotFoundError(f"Link {link_id} does not exist")
        return await self.check_link(link)

    async def check_link(self, link: Link) -> Link:
        link.health_status = LinkHealthStatus.CHECKING
        link.status_code = None
        link.response_time_ms = None
        await self.links.session.flush()

        started = perf_counter()
        status_code: int | None = None
        parsed = urlparse(link.url)
        try:
            if parsed.scheme not in {"http", "https"}:
                raise httpx.UnsupportedProtocol("Only HTTP and HTTPS URLs can be checked")
            async with httpx.AsyncClient(
                timeout=self.timeout,
                follow_redirects=True,
                max_redirects=10,
            ) as client:
                response = await client.head(link.url)
                if response.status_code == 405:
                    response = await client.get(link.url)
                status_code = response.status_code
            elapsed_ms = max(0, round((perf_counter() - started) * 1000))
            if 200 <= status_code <= 299:
                health = (
                    LinkHealthStatus.WARNING
                    if elapsed_ms > self.warning_latency_ms
                    else LinkHealthStatus.HEALTHY
                )
            elif 300 <= status_code <= 399:
                health = LinkHealthStatus.WARNING
            else:
                health = LinkHealthStatus.ERROR
        except (httpx.HTTPError, OSError):
            elapsed_ms = max(0, round((perf_counter() - started) * 1000))
            health = LinkHealthStatus.ERROR

        return await self.links.update(
            link,
            {
                "status_code": status_code,
                "health_status": health,
                "last_checked_at": datetime.now(UTC),
                "response_time_ms": elapsed_ms,
            },
        )

    async def queue_all(self, user_id: UUID) -> int:
        links = await self.links.list_for_owner(user_id)
        for link in links:
            link.health_status = LinkHealthStatus.CHECKING
        await self.links.session.flush()
        return len(links)
