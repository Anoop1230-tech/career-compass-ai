"""Career Explorer API: expand the career tree one node at a time."""
from fastapi import APIRouter, Depends, HTTPException, Path, Query, status
from sqlalchemy.orm import Session

from database import get_db
from engine.catalog_data import get_catalog
from engine.context import build_context
from engine.explore import UnknownNode, children, node_info
from models import User
from routes.next_steps import REFERENCE_DATA_MISSING
from services.auth import get_optional_user

router = APIRouter(prefix="/explore", tags=["explore"])
START_STAGE = "EDU_CLASS_10"


@router.get("")
def root(
    stage: str | None = Query(default=None, max_length=40),
    user: User | None = Depends(get_optional_user),
    db: Session = Depends(get_db),
):
    """The starting node: ?stage=, else the profile stage, else Class 10."""
    catalog = get_catalog(db)
    if catalog.is_empty:
        raise REFERENCE_DATA_MISSING
    source = "query"
    if stage is None:
        ctx = build_context(db, catalog, user.id if user else None)
        stage, source = (ctx.stage.stage_id, "profile") if ctx.stage.stage_id else (START_STAGE, "default")
    try:
        node = node_info(catalog, "stage", stage)
    except UnknownNode:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Unknown stage.") from None
    node["children"] = children(catalog, "stage", stage)
    return {"source": source, "root": node}


@router.get("/{kind}/{node_id}")
def expand(kind: str = Path(pattern="^(stage|career|exam)$"), node_id: str = Path(max_length=40),
           db: Session = Depends(get_db)):
    catalog = get_catalog(db)
    if catalog.is_empty:
        raise REFERENCE_DATA_MISSING
    try:
        return {"node": node_info(catalog, kind, node_id), "children": children(catalog, kind, node_id)}
    except UnknownNode:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Not found.") from None