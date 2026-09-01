"""Operations on individual links.

Creation lives under /projects/{id}/links because a link cannot exist without a
project; update and delete address the link directly by its own id.
"""

from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, status

from app.api.deps import CurrentUser, LinkHealthSvc, LinkSvc
from app.db.session import AsyncSessionLocal
from app.models.enums import LinkHealthStatus
from app.repositories.link import LinkRepository
from app.schemas.link import LinkResponse, LinkUpdate
from app.services.link_health import LinkHealthService

router = APIRouter()


async def _check_all_in_background(user_id: UUID) -> None:
    async with AsyncSessionLocal() as session:
        repository = LinkRepository(session)
        service = LinkHealthService(repository)
        links = await repository.list_for_owner(user_id)
        for link in links:
            link.health_status = LinkHealthStatus.CHECKING
        await session.commit()

        for link in links:
            try:
                await service.check_link(link)
                await session.commit()
            except Exception:  # one broken target must not stop the workspace batch
                await session.rollback()


@router.post("/check-all-health", status_code=status.HTTP_202_ACCEPTED)
async def check_all_health(
    background_tasks: BackgroundTasks,
    service: LinkHealthSvc,
    current_user: CurrentUser,
) -> dict[str, int]:
    queued = len(await service.links.list_for_owner(current_user.id))
    background_tasks.add_task(_check_all_in_background, current_user.id)
    return {"queued": queued}


@router.post("/{link_id}/check-health", response_model=LinkResponse)
async def check_link_health(
    link_id: UUID,
    service: LinkHealthSvc,
    current_user: CurrentUser,
) -> LinkResponse:
    return LinkResponse.model_validate(await service.check(link_id, current_user.id))


@router.get(
    "/{link_id}",
    response_model=LinkResponse,
    summary="Get a link",
    responses={404: {"description": "Link not found"}},
)
async def get_link(
    link_id: UUID,
    service: LinkSvc,
    current_user: CurrentUser,
) -> LinkResponse:
    link = await service.get(link_id, current_user.id)
    return LinkResponse.model_validate(link)


@router.put(
    "/{link_id}",
    response_model=LinkResponse,
    summary="Update a link",
    description="Partial update: omitted fields keep their current value.",
    responses={404: {"description": "Link not found"}},
)
async def update_link(
    link_id: UUID,
    payload: LinkUpdate,
    service: LinkSvc,
    current_user: CurrentUser,
) -> LinkResponse:
    link = await service.update(link_id, payload, current_user.id)
    return LinkResponse.model_validate(link)


@router.delete(
    "/{link_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a link",
    responses={404: {"description": "Link not found"}},
)
async def delete_link(
    link_id: UUID,
    service: LinkSvc,
    current_user: CurrentUser,
) -> None:
    await service.delete(link_id, current_user.id)

@router.put("/{link_id}/bookmark", response_model=LinkResponse, summary="Bookmark a link")
async def bookmark_link(link_id: UUID, service: LinkSvc, current_user: CurrentUser) -> LinkResponse:
    return LinkResponse.model_validate(await service.set_bookmark(link_id, current_user.id, True))

@router.delete("/{link_id}/bookmark", response_model=LinkResponse, summary="Remove a bookmark")
async def unbookmark_link(link_id: UUID, service: LinkSvc, current_user: CurrentUser) -> LinkResponse:
    return LinkResponse.model_validate(await service.set_bookmark(link_id, current_user.id, False))
