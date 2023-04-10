from django.core.management.base import BaseCommand
from django.db import connections


class Command(BaseCommand):
    def handle(self, **options):
        with connections['infra'].cursor() as cursor:
            cursor.execute("""
            SELECT * FROM iasql_install(
                'aws_ecs_simplified', 'aws_codebuild'
            );
            """)
