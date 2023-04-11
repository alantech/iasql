import os

from django.core.management.base import BaseCommand
from django.db import connections

from infra.models import EcsSimplified


class Command(BaseCommand):
    def handle(self, **options):
        ecs_deployment, _ = EcsSimplified.objects.using('infra').get_or_create(
            app_name='quickstart',
            public_ip=True,
            app_port=8088,
            image_tag='latest',
            cpu_mem='vCPU2-8GB',
            desired_count=1
        )

        with connections['infra'].cursor() as cursor:
            cursor.callproc('iasql_begin')
            cursor.callproc('iasql_commit')
            columns = [col[0] for col in cursor.description]
            print("\n")
            print([
                dict(zip(columns, row))
                for row in cursor.fetchall()
            ])

        with connections['infra'].cursor() as cursor:
            cursor.execute("""
            SELECT ecr_build(
                '{GITHUB_SERVER_URL}/{GITHUB_REPOSITORY}',
                (SELECT id FROM repository WHERE repository_name = 'quickstart-repository')::varchar(255),
                './examples/ecs-fargate/django/app',
                '{GITHUB_REF}',
                '{GH_PAT}'
              );
              """.format(
                GITHUB_SERVER_URL=os.environ['GITHUB_SERVER_URL'],
                GITHUB_REPOSITORY=os.environ['GITHUB_REPOSITORY'],
                GITHUB_REF=os.environ['GITHUB_REF'],
                GH_PAT=os.environ['GH_PAT']))
