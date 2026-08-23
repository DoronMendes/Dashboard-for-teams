from uuid import uuid4

from fastapi.testclient import TestClient

PROJECTS = "/api/v1/projects"
LINKS = "/api/v1/links"


def test_create_link_under_a_project(client: TestClient, project: dict) -> None:
    response = client.post(
        f"{PROJECTS}/{project['id']}/links",
        json={"title": "Staging", "url": "https://stg.internal", "category": "environment"},
    )
    assert response.status_code == 201
    body = response.json()
    assert body["project_id"] == project["id"]
    assert body["category"] == "environment"
    assert body["position"] == 0


def test_category_defaults_to_other(client: TestClient, project: dict) -> None:
    body = client.post(
        f"{PROJECTS}/{project['id']}/links",
        json={"title": "Misc", "url": "https://example.com"},
    ).json()
    assert body["category"] == "other"


def test_unknown_category_is_rejected(client: TestClient, project: dict) -> None:
    response = client.post(
        f"{PROJECTS}/{project['id']}/links",
        json={"title": "X", "url": "https://example.com", "category": "not-a-category"},
    )
    assert response.status_code == 422


def test_malformed_url_is_rejected(client: TestClient, project: dict) -> None:
    response = client.post(
        f"{PROJECTS}/{project['id']}/links",
        json={"title": "X", "url": "definitely not a url"},
    )
    assert response.status_code == 422


def test_creating_a_link_on_a_missing_project_returns_404(client: TestClient) -> None:
    response = client.post(
        f"{PROJECTS}/{uuid4()}/links",
        json={"title": "X", "url": "https://example.com"},
    )
    assert response.status_code == 404


def test_list_links_filtered_by_category(client: TestClient, project: dict) -> None:
    for title, url, category in [
        ("Staging", "https://stg.internal", "environment"),
        ("Prod", "https://prod.internal", "environment"),
        ("Swagger", "https://stg.internal/docs", "docs"),
    ]:
        client.post(
            f"{PROJECTS}/{project['id']}/links",
            json={"title": title, "url": url, "category": category},
        )

    assert len(client.get(f"{PROJECTS}/{project['id']}/links").json()) == 3
    filtered = client.get(f"{PROJECTS}/{project['id']}/links", params={"category": "environment"})
    assert len(filtered.json()) == 2


def test_update_link_fields(client: TestClient, project: dict) -> None:
    link = client.post(
        f"{PROJECTS}/{project['id']}/links",
        json={"title": "Old", "url": "https://old.internal", "category": "docs"},
    ).json()

    body = client.put(f"{LINKS}/{link['id']}", json={"title": "New", "category": "logs"}).json()
    assert body["title"] == "New"
    assert body["category"] == "logs"
    assert body["url"] == "https://old.internal"  # untouched


def test_update_link_rejects_project_reassignment(client: TestClient, project: dict) -> None:
    link = client.post(
        f"{PROJECTS}/{project['id']}/links",
        json={"title": "X", "url": "https://example.com"},
    ).json()
    response = client.put(f"{LINKS}/{link['id']}", json={"project_id": str(uuid4())})
    assert response.status_code == 422


def test_update_unknown_link_returns_404(client: TestClient) -> None:
    assert client.put(f"{LINKS}/{uuid4()}", json={"title": "X"}).status_code == 404


def test_delete_link(client: TestClient, project: dict) -> None:
    link = client.post(
        f"{PROJECTS}/{project['id']}/links",
        json={"title": "X", "url": "https://example.com"},
    ).json()

    assert client.delete(f"{LINKS}/{link['id']}").status_code == 204
    assert client.get(f"{LINKS}/{link['id']}").status_code == 404

    # the parent project survives
    assert client.get(f"{PROJECTS}/{project['id']}").status_code == 200


def test_delete_unknown_link_returns_404(client: TestClient) -> None:
    assert client.delete(f"{LINKS}/{uuid4()}").status_code == 404


def test_links_can_be_reordered_within_their_project(
    client: TestClient, project: dict
) -> None:
    links = [
        client.post(
            f"{PROJECTS}/{project['id']}/links",
            json={"title": f"Link {index}", "url": f"https://example.com/{index}"},
        ).json()
        for index in range(3)
    ]
    reordered_ids = [links[1]["id"], links[2]["id"], links[0]["id"]]

    response = client.put(
        f"{PROJECTS}/{project['id']}/links/reorder",
        json={"ids": reordered_ids},
    )
    assert response.status_code == 204
    result = client.get(f"{PROJECTS}/{project['id']}/links").json()
    assert [item["id"] for item in result] == reordered_ids


def test_link_reorder_rejects_a_link_from_another_project(
    client: TestClient, project: dict
) -> None:
    other = client.post(PROJECTS, json={"name": "Other"}).json()
    foreign_link = client.post(
        f"{PROJECTS}/{other['id']}/links",
        json={"title": "Foreign", "url": "https://example.com/foreign"},
    ).json()
    response = client.put(
        f"{PROJECTS}/{project['id']}/links/reorder",
        json={"ids": [foreign_link["id"]]},
    )
    assert response.status_code == 404
