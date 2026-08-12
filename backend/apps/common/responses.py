from rest_framework.response import Response


def success(data=None, status=200):
    return Response({"success": True, "data": data if data is not None else {}}, status=status)
