"""Project endpoints."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Query, status

from app.api.deps import CurrentUser, LinkSvc, PageParams, ProjectSvc
from app.models.enums import LinkCategory
from app.schemas.link import LinkCreate, LinkResponse
from app.schemas.project import ProjectCreate, ProjectResponse, ProjectUpdate
from app.schemas.reorder import ReorderRequest

router = APIRouter()


@router.put(
    "/reorder",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Reorder projects",
    responses={404: {"description": "One or more projects not found"}},
)
async def reorder_projects(
    payload: ReorderRequest,
    service: ProjectSvc,
    current_user: CurrentUser,
) -> None:
    await service.reorder(payload.ids, current_user.id)


@router.post(
    "",
    response_model=ProjectResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a project",
    responses={409: {"description": "A project with that name already exists"}},
)
async def create_project(
    payload: ProjectCreate,
    service: ProjectSvc,
    current_user: CurrentUser,
) -> ProjectResponse:
    project = await service.create(payload, current_user.id)
    return ProjectResponse.model_validate(project)


@router.get(
    "",
    response_model=list[ProjectResponse],
    summary="List projects with their links",
)
async def list_projects(
    service: ProjectSvc,
    page: PageParams,
    current_user: CurrentUser,
    q: Annotated[
        str | None, Query(description="Case-insensitive search on name and description")
    ] = None,
) -> list[ProjectResponse]:
    projects = await service.list(
        current_user.id,
        q=q,
        skip=page.skip,
        limit=page.limit,
    )
    return [ProjectResponse.model_validate(project) for project in projects]


@router.get(
    "/{project_id}",
    response_model=ProjectResponse,
    summary="Get one project with its links",
    responses={404: {"description": "Project not found"}},
)
async def get_project(
    project_id: UUID,
    service: ProjectSvc,
    current_user: CurrentUser,
) -> ProjectResponse:
    project = await service.get(project_id, current_user.id)
    return ProjectResponse.model_validate(project)


@router.put(
    "/{project_id}",
    response_model=ProjectResponse,
    summary="Update a project",
    description="Partial update: omitted fields keep their current value.",
    responses={404: {"description": "Project not found"}, 409: {"description": "Name taken"}},
)
async def update_project(
    project_id: UUID,
    payload: ProjectUpdate,
    service: ProjectSvc,
    current_user: CurrentUser,
) -> ProjectResponse:
    project = await service.update(project_id, payload, current_user.id)
    return ProjectResponse.model_validate(project)


@router.delete(
    "/{project_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a project and all of its links",
    responses={404: {"description": "Project not found"}},
)
async def delete_project(
    project_id: UUID,
    service: ProjectSvc,
    current_user: CurrentUser,
) -> None:
    await service.delete(project_id, current_user.id)


# --- links nested under a project -------------------------------------------


@router.put(
    "/{project_id}/links/reorder",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Reorder links within a project",
    responses={404: {"description": "Project or one of its links not found"}},
)
async def reorder_project_links(
    project_id: UUID,
    payload: ReorderRequest,
    service: LinkSvc,
    current_user: CurrentUser,
) -> None:
    await service.reorder_for_project(project_id, payload.ids, current_user.id)


@router.post(
    "/{project_id}/links",
    response_model=LinkResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Add a link to a project",
    responses={404: {"description": "Project not found"}},
)
async def create_project_link(
    project_id: UUID,
    payload: LinkCreate,
    service: LinkSvc,
    current_user: CurrentUser,
) -> LinkResponse:
    link = await service.create_for_project(project_id, payload, current_user.id)
    return LinkResponse.model_validate(link)


@router.get(
    "/{project_id}/links",
    response_model=list[LinkResponse],
    summary="List a project's links",
    responses={404: {"description": "Project not found"}},
)
async def list_project_links(
    project_id: UUID,
    service: LinkSvc,
    page: PageParams,
    current_user: CurrentUser,
    category: Annotated[LinkCategory | None, Query(description="Filter by category")] = None,
) -> list[LinkResponse]:
    links = await service.list_for_project(
        project_id,
        current_user.id,
        category=category.value if category else None,
        skip=page.skip,
        limit=page.limit,
    )
    return [LinkResponse.model_validate(link) for link in links]
