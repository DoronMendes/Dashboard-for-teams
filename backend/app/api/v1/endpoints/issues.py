from uuid import UUID

from fastapi import APIRouter, status
from sqlalchemy import select

from app.api.deps import CurrentUser, DBSession
from app.core.exceptions import EntityNotFoundError
from app.models.collaboration import Workspace, WorkspaceMembership
from app.models.engagement import IssueReport, Notification
from app.models.user import User
from app.schemas.issue import IssueReportCreate, IssueReportDetailResponse, IssueReportResponse

router = APIRouter()


@router.post("", response_model=IssueReportResponse, status_code=status.HTTP_201_CREATED)
async def create_issue_report(
    payload: IssueReportCreate,
    current_user: CurrentUser,
    session: DBSession,
) -> IssueReport:
    membership = await session.scalar(
        select(WorkspaceMembership).where(
            WorkspaceMembership.workspace_id == payload.workspace_id,
            WorkspaceMembership.user_id == current_user.id,
        )
    )
    if membership is None:
        raise EntityNotFoundError("Workspace not found")

    workspace = await session.get(Workspace, payload.workspace_id)
    report = IssueReport(
        workspace_id=payload.workspace_id,
        reporter_id=current_user.id,
        title=payload.title.strip(),
        description=payload.description.strip(),
        category=payload.category,
        urgency=payload.urgency,
        page_url=payload.page_url,
        status="new",
    )
    session.add(report)
    await session.flush()

    managers = list(
        (
            await session.execute(
                select(WorkspaceMembership).where(
                    WorkspaceMembership.workspace_id == payload.workspace_id,
                    WorkspaceMembership.role.in_(("owner", "admin")),
                )
            )
        ).scalars()
    )
    workspace_name = workspace.name if workspace else "Workspace"
    for manager in managers:
        session.add(
            Notification(
                user_id=manager.user_id,
                kind="issue_report",
                message=(
                    f'דיווח תקלה חדש מאת {current_user.name}: "{report.title}" '
                    f"({workspace_name})\n\nתיאור התקלה:\n{report.description}"
                ),
                target_path=f"/issue-reports/{report.id}",
                is_read=False,
            )
        )
    await session.flush()
    await session.refresh(report)
    return report


@router.get("/{report_id}", response_model=IssueReportDetailResponse)
async def get_issue_report(
    report_id: UUID,
    current_user: CurrentUser,
    session: DBSession,
) -> IssueReportDetailResponse:
    report = await session.get(IssueReport, report_id)
    if report is None:
        raise EntityNotFoundError("Issue report not found")

    membership = await session.scalar(
        select(WorkspaceMembership).where(
            WorkspaceMembership.workspace_id == report.workspace_id,
            WorkspaceMembership.user_id == current_user.id,
            WorkspaceMembership.role.in_(("owner", "admin")),
        )
    )
    if membership is None:
        raise EntityNotFoundError("Issue report not found")

    reporter = await session.get(User, report.reporter_id)
    workspace = await session.get(Workspace, report.workspace_id)
    return IssueReportDetailResponse(
        **IssueReportResponse.model_validate(report).model_dump(),
        reporter_name=reporter.name if reporter else "Unknown",
        reporter_email=reporter.email if reporter else "",
        workspace_name=workspace.name if workspace else "Workspace",
    )
