"""Link checker logic, tested offline with a fake network."""
import httpx

from catalog.link_check import check, collect_urls
from catalog.validator import validate


def fake_client(handler):
    return httpx.Client(transport=httpx.MockTransport(handler), follow_redirects=True)


def test_collects_every_url_once_with_where_it_is_used():
    _, tables = validate()
    urls = collect_urls(tables)
    assert "https://gate2027.iitm.ac.in/" in urls
    places = urls["https://gate2027.iitm.ac.in/"]
    assert "entrance_exams.csv:EXM_GATE" in places
    assert len(places) > 1  # also used by education paths
    assert all(u.startswith("https://") for u in urls)


def test_ok_page():
    with fake_client(lambda req: httpx.Response(200)) as client:
        assert check("https://example.org/", client) == ("https://example.org/", "ok")


def test_head_rejected_falls_back_to_get():
    def handler(request):
        return httpx.Response(405 if request.method == "HEAD" else 200)

    with fake_client(handler) as client:
        assert check("https://example.org/", client)[1] == "ok"


def test_broken_page_is_reported():
    with fake_client(lambda req: httpx.Response(404)) as client:
        assert check("https://example.org/gone", client)[1] == "HTTP 404"


def test_timeout_is_retried_then_reported():
    calls = []

    def handler(request):
        calls.append(request.method)
        raise httpx.ConnectTimeout("slow", request=request)

    with fake_client(handler) as client:
        assert check("https://example.org/", client)[1] == "timeout"
    assert len(calls) == 2  # tried twice


def test_one_slow_attempt_then_success_is_ok():
    calls = []

    def handler(request):
        calls.append(1)
        if len(calls) == 1:
            raise httpx.ConnectTimeout("slow", request=request)
        return httpx.Response(200)

    with fake_client(handler) as client:
        assert check("https://example.org/", client)[1] == "ok"
