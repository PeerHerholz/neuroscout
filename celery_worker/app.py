from celery import Celery
from os import environ
from neuroscout.basic import create_app

celery_app = Celery(
    'tasks', broker=environ.get('CELERY_BROKER_URL'),
    backend=environ.get('CELERY_RESULT_BACKEND'), include=['tasks'])

# Push db context
flask_app = create_app()
flask_app.app_context().push()
