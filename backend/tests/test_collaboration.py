from fastapi.testclient import TestClient

def test_default_workspace_team_and_permissions(client: TestClient, project: dict) -> None:
    workspaces = client.get("/api/v1/workspaces")
    assert workspaces.status_code == 200
    workspace = workspaces.json()[0]
    assert workspace["role"] == "owner"
    assert workspace["members"][0]["email"] == "test@example.com"
    team = client.post(f"/api/v1/workspaces/{workspace['id']}/teams", json={"name": "Engineering"})
    assert team.status_code == 201, team.text
    assert team.json()["name"] == "Engineering"
    assert project["workspace_id"] == workspace["id"]

def test_admin_can_invite_google_email_before_first_login(client: TestClient, project: dict) -> None:
    workspace = client.get("/api/v1/workspaces").json()[0]
    response = client.post(f"/api/v1/workspaces/{workspace['id']}/invitations", json={"email": "new.person@gmail.com", "role": "admin"})
    assert response.status_code == 201, response.text
    assert response.json()["email"] == "new.person@gmail.com"
    assert response.json()["role"] == "admin"
    assert response.json()["accepted_at"] is None
