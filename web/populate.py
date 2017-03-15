""" Populate database from command line """
import os

from flask_script import Manager
from app import app
from database import db
import json

from bids.grabbids import BIDSLayout
import pandas as pd

app.config.from_object(os.environ['APP_SETTINGS'])
db.init_app(app)
manager = Manager(app)

@manager.command
def add_dataset(bids_path, task):
    from models import Dataset, Run, Predictor, PredictorEvent

    dataset_di = {}
    dataset_di['description'] = json.load(open(
        os.path.join(bids_path, 'dataset_description.json'), 'r'))
    dataset_di['task_description'] = json.load(open(
        os.path.join(bids_path, 'task-{}_bold.json'.format(task)), 'r'))
    dataset_di['name'] = dataset_di['description']['Name']
    dataset_di['task'] = task

    layout = BIDSLayout(bids_path)

    if task not in layout.get_tasks():
        raise ValueError("No such task")

    dataset = Dataset.query.filter_by(name=dataset_di['name']).first()
    if dataset:
        print("Dataset already in db.")
    else:
        dataset = Dataset(**dataset_di)
        db.session.add(dataset)
        db.session.commit()

    for run in layout.get(task=task, type='events'):
        print("Processing subject {}, {}".format(run.subject, run.run))
        run_model = Run(subject=run.subject, number=run.run, task=task,
                        dataset_id=dataset.id)
        db.session.add(run_model)
        db.session.commit()

        tsv = pd.read_csv(run.filename, delimiter='\t', index_col=0)
        tsv = dict(tsv.iteritems())
        onsets = tsv.pop('onset')
        durations = tsv.pop('duration')
        stims = tsv.pop('stim_file')

        for col in tsv.keys():
            predictor = Predictor(name=col, run_id=run_model.id)
            db.session.add(predictor)
            db.session.commit()

            for i, val in tsv[col].items():
                predictor_event = PredictorEvent(onset=onsets[i].item(),
                                                 duration = durations[i].item(),
                                                 value = str(val),
                                                 predictor_id=predictor.id)
                db.session.add(predictor_event)
                db.session.commit()

        # Ingest stimuli, maybe do some hashing here if you want

if __name__ == '__main__':
    manager.run()
