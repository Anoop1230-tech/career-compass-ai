"""Profile endpoints. Every route requires login, and users can only
ever read or change their OWN profile (the user comes from the cookie,
never from the URL or request body)."""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

import profile_options as opt
from database import get_db
from engine.profile_hints import profile_hints
from models import Profile, User
from schemas import ProfileIn, ProfileOut
from services.auth import get_current_user

router = APIRouter(tags=["profile"])


@router.get("/profile/options")
def profile_options():
    """Choice lists for the profile form (public, no login needed)."""
    return {
        "stages": opt.as_json(opt.STAGES),
        "school_stages": sorted(opt.SCHOOL_STAGES),
        "work_stages": sorted(opt.WORK_STAGES),
        "streams": opt.as_json(opt.STREAMS),
        "score_types": opt.as_json(opt.SCORE_TYPES),
        "skill_categories": opt.as_json(opt.SKILL_CATEGORIES),
        "skill_levels": opt.as_json(opt.SKILL_LEVELS),
        "interests": opt.as_json(opt.INTERESTS),
        "goals": opt.as_json(opt.GOALS),
        "work_modes": opt.as_json(opt.WORK_MODES),
    }


@router.get("/profile/hints")
def get_profile_hints(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Values to pre-fill a new profile: name (Google account or a clear first.last email)
    and institution (email domain = an official college/university website)."""
    return profile_hints(db, user)


@router.get("/profile", response_model=ProfileOut)
def get_profile(user: User = Depends(get_current_user)):
    if user.profile is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "You have not created a profile yet.")
    return user.profile


@router.put("/profile", response_model=ProfileOut)
def save_profile(data: ProfileIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Create the profile, or replace it completely if it already exists."""
    values = data.model_dump(mode="json")  # mode="json": URLs etc. become plain strings
    profile = user.profile
    if profile is None:
        profile = Profile(user_id=user.id, **values)
        db.add(profile)
    else:
        for field, value in values.items():
            setattr(profile, field, value)
    db.commit()
    db.refresh(profile)
    return profile


@router.delete("/profile", status_code=status.HTTP_204_NO_CONTENT)
def delete_profile(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if user.profile is not None:
        db.delete(user.profile)
        db.commit()
