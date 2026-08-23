from uuid import UUID

from fastapi import APIRouter, status

from app.api.deps import CollaborationSvc, CurrentUser
from app.schemas.collaboration import (
    InvitationResponse,
    MemberCreate,
    MemberResponse,
    TeamCreate,
    TeamResponse,
    WorkspaceResponse,
)

router = APIRouter()


@router.get("/workspaces", response_model=list[WorkspaceResponse])
async def workspaces(service: CollaborationSvc, current_user: CurrentUser):
    return await service.list_workspaces(current_user.id, current_user.name)


@router.post(
    "/workspaces/{workspace_id}/teams",
    response_model=TeamResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_team(
    workspace_id: UUID, payload: TeamCreate, service: CollaborationSvc, current_user: CurrentUser
):
    return await service.create_team(workspace_id, payload.name, current_user.id)


@router.post(
    "/workspaces/{workspace_id}/members",
    response_model=MemberResponse,
    status_code=status.HTTP_201_CREATED,
)
async def add_member(
    workspace_id: UUID, payload: MemberCreate, service: CollaborationSvc, current_user: CurrentUser
):
    return await service.add_member(workspace_id, payload.email, payload.role, current_user.id)


@router.post(
    "/workspaces/{workspace_id}/invitations",
    response_model=InvitationResponse,
    status_code=status.HTTP_201_CREATED,
)
async def invite(
    workspace_id: UUID, payload: MemberCreate, service: CollaborationSvc, current_user: CurrentUser
):
    return await service.invite(workspace_id, payload.email, payload.role, current_user.id)
