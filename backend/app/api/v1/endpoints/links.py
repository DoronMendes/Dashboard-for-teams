"""Operations on individual links.

Creation lives under /projects/{id}/links because a link cannot exist without a
project; update and delete address the link directly by its own id.
"""

from uuid import UUID

from fastapi import APIRouter, status

from app.api.deps import CurrentUser, LinkSvc
from app.schemas.link import LinkResponse, LinkUpdate

router = APIRouter()


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
