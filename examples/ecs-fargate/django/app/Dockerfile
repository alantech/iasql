FROM public.ecr.aws/docker/library/python:3.9

COPY . ./code

WORKDIR /code

RUN pip install -r requirements.txt

CMD python manage.py runserver --noreload 0.0.0.0:8088
