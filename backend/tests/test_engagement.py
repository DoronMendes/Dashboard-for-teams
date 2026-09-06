from fastapi.testclient import TestClient


def test_activity_analytics_visit_and_empty_notifications(
    client: TestClient, project: dict
) -> None:
    link = client.post(
        f"/api/v1/projects/{project['id']}/links",
        json={"title": "Docs", "url": "https://example.com"},
    ).json()
    activity = client.get("/api/v1/activity")
    assert activity.status_code == 200
    assert any(item["details"].get("title") == "Docs" for item in activity.json())
    visit = client.post(f"/api/v1/links/{link['id']}/visit")
    assert visit.status_code == 200 and visit.json()["url"] == "https://example.com"
    analytics = client.get("/api/v1/analytics").json()
    assert analytics["total_projects"] == 1
    assert analytics["total_links"] == 1
    assert analytics["total_visits"] == 1
    assert analytics["most_visited"]["id"] == link["id"]
    assert analytics["most_visited"]["visits"] == 1
    assert analytics["weekly_active_users"] == 1
    assert analytics["slow_links"] == 0
    assert analytics["project_with_most_errors"] is None

    trend = client.get("/api/v1/analytics/clicks-trend?interval=daily&range=30d")
    assert trend.status_code == 200
    assert sum(point["clicks"] for point in trend.json()) == 1

    active = client.get("/api/v1/analytics/active-users?range=7d")
    assert active.status_code == 200
    assert active.json()["active_users"] == 1
    assert active.json()["dau"] == 1

    leaders = client.get("/api/v1/analytics/top-projects?limit=5")
    assert leaders.status_code == 200
    assert leaders.json()[0]["name"] == project["name"]
    assert leaders.json()[0]["links_count"] == 1
    assert leaders.json()[0]["clicks"] == 1
    assert leaders.json()[0]["unique_visitors"] == 1
    assert len(leaders.json()[0]["visitors"]) == 1
    assert leaders.json()[0]["visitors"][0]["name"]
    assert leaders.json()[0]["visitors"][0]["email"]
    assert leaders.json()[0]["traffic_share"] == 100.0
    assert client.get("/api/v1/notifications").json() == []
    assert client.get("/api/v1/notifications/unread-count").json() == {"count": 0}


def test_issue_report_notifies_workspace_owner(client: TestClient, project: dict) -> None:
    response = client.post(
        "/api/v1/issue-reports",
        json={
            "workspace_id": project["workspace_id"],
            "title": "Dashboard button is stuck",
            "description": "The button does not respond after clicking it twice.",
            "category": "display",
            "urgency": "normal",
            "page_url": "http://localhost:5173/settings",
        },
    )

    assert response.status_code == 201, response.text
    assert response.json()["status"] == "new"
    notifications = client.get("/api/v1/notifications").json()
    assert len(notifications) == 1
    assert notifications[0]["kind"] == "issue_report"
    assert "Dashboard button is stuck" in notifications[0]["message"]
    assert "The button does not respond after clicking it twice." in notifications[0]["message"]
    assert notifications[0]["target_path"] == f'/issue-reports/{response.json()["id"]}'
    report_details = client.get(f'/api/v1/issue-reports/{response.json()["id"]}')
    assert report_details.status_code == 200, report_details.text
    assert report_details.json()["description"] == "The button does not respond after clicking it twice."
    assert report_details.json()["workspace_name"]
    assert report_details.json()["reporter_name"]
    assert client.get("/api/v1/notifications/unread-count").json() == {"count": 1}
