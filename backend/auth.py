"""Optional token authentication (plan Phase 6, "simple JWT" MVP).

Uses itsdangerous-signed tokens (bundled with Flask) instead of the PyJWT
package — same idea: client registers/logs in, receives a signed token,
and sends it as `Authorization: Bearer <token>`. Tokens expire after 7 days.

Auth is deliberately *optional*: anonymous use works exactly as before
(local single-user mode). Logging in scopes the recording list to your own
uploads and attributes them on the community leaderboard.
"""
from functools import wraps

from flask import current_app, g, request
from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer

from models import User, db

TOKEN_MAX_AGE_S = 7 * 24 * 3600  # 7 days


def _serializer() -> URLSafeTimedSerializer:
    return URLSafeTimedSerializer(current_app.config["SECRET_KEY"], salt="wgsi-auth")


def _bearer_token():
    header = request.headers.get("Authorization", "")
    return header[7:].strip() if header.startswith("Bearer ") else None


def issue_token(user: User) -> str:
    return _serializer().dumps({"uid": user.id})


def user_from_token(token):
    """Resolve a User from a token, or None if invalid/expired/unknown."""
    if not token:
        return None
    try:
        data = _serializer().loads(token, max_age=TOKEN_MAX_AGE_S)
    except (BadSignature, SignatureExpired):
        return None
    return db.session.get(User, data.get("uid"))


def optional_auth(fn):
    """Attach g.user when a valid token is present; never blocks."""
    @wraps(fn)
    def wrapper(*args, **kwargs):
        g.user = user_from_token(_bearer_token())
        return fn(*args, **kwargs)
    return wrapper


def require_auth(fn):
    """401 unless a valid token is present; attaches g.user."""
    @wraps(fn)
    def wrapper(*args, **kwargs):
        user = user_from_token(_bearer_token())
        if user is None:
            from flask import abort

            abort(401, description="Authentication required. Log in first.")
        g.user = user
        return fn(*args, **kwargs)
    return wrapper
