import logging

from django.http import Http404
from rest_framework import status
from rest_framework.exceptions import APIException, PermissionDenied, ValidationError
from rest_framework.response import Response
from rest_framework.views import exception_handler as drf_exception_handler

logger = logging.getLogger(__name__)


class ConflictError(APIException):
    status_code = status.HTTP_409_CONFLICT
    default_detail = "A conflict occurred with the current state of the resource."
    default_code = "conflict"


def _error_code_for(exc, response):
    if isinstance(exc, ValidationError):
        return "VALIDATION_ERROR"
    if isinstance(exc, PermissionDenied):
        return "PERMISSION_DENIED"
    if isinstance(exc, Http404):
        return "NOT_FOUND"
    if response is not None:
        mapping = {
            400: "BAD_REQUEST",
            401: "UNAUTHORIZED",
            403: "PERMISSION_DENIED",
            404: "NOT_FOUND",
            405: "METHOD_NOT_ALLOWED",
            409: "CONFLICT",
            429: "THROTTLED",
        }
        return mapping.get(response.status_code, "ERROR")
    return "SERVER_ERROR"


def custom_exception_handler(exc, context):
    """
    Wraps every DRF error response in the platform-standard envelope:
    { "success": false, "error": { "code": ..., "message": ..., "fields": {...} } }
    """
    response = drf_exception_handler(exc, context)

    if response is None:
        logger.exception("Unhandled exception", exc_info=exc)
        return Response(
            {
                "success": False,
                "error": {
                    "code": "SERVER_ERROR",
                    "message": "An unexpected error occurred.",
                },
            },
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    code = _error_code_for(exc, response)
    message = "Validation failed." if code == "VALIDATION_ERROR" else str(
        response.data.get("detail", "An error occurred.")
        if isinstance(response.data, dict)
        else "Validation failed."
    )

    error_payload = {"code": code, "message": message}

    if isinstance(response.data, dict) and code == "VALIDATION_ERROR":
        error_payload["fields"] = response.data
    elif isinstance(response.data, list):
        error_payload["fields"] = {"non_field_errors": response.data}

    response.data = {"success": False, "error": error_payload}
    return response
