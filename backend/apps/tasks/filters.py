import django_filters

from apps.tasks.models import Task


class TaskFilter(django_filters.FilterSet):
    search = django_filters.CharFilter(field_name="title", lookup_expr="icontains")
    status = django_filters.ChoiceFilter(choices=Task.Status.choices)
    priority = django_filters.ChoiceFilter(choices=Task.Priority.choices)
    project = django_filters.NumberFilter(field_name="project_id")
    assigned_to = django_filters.NumberFilter(field_name="assigned_to_id")
    due_before = django_filters.DateFilter(field_name="due_date", lookup_expr="lte")
    due_after = django_filters.DateFilter(field_name="due_date", lookup_expr="gte")

    class Meta:
        model = Task
        fields = ["search", "status", "priority", "project", "assigned_to", "due_before", "due_after"]
