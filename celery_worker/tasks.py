import tarfile
import json
import re
from tempfile import mkdtemp
from pathlib import Path
from app import celery_app
from compile import build_analysis, PathBuilder, impute_confounds
from celery.utils.log import get_task_logger
from pynv import Client
from viz import plot_design_matrix, plot_corr_matrix, sort_dm

logger = get_task_logger(__name__)


@celery_app.task(name='workflow.compile')
def compile(analysis, predictor_events, resources, bids_dir, run_ids,
            validation_hash, build=False):
    tmp_dir, bundle_paths, _ = build_analysis(
        analysis, predictor_events, bids_dir, run_ids, build=build)

    sidecar = {"RepetitionTime": analysis['TR']}
    resources["validation_hash"] = validation_hash

    # Write out JSON files
    for obj, name in [
      (analysis, 'analysis'),
      (resources, 'resources'),
      (analysis.get('model'), 'model'),
      (sidecar, 'task-{}_bold'.format(analysis['task_name']))]:

        path = (tmp_dir / name).with_suffix('.json')
        json.dump(obj, path.open('w'))
        bundle_paths.append((path.as_posix(), path.name))

    # Save bundle as tarball
    bundle_path = '/file-data/analyses/{}_bundle.tar.gz'.format(
        analysis['hash_id'])
    with tarfile.open(bundle_path, "w:gz") as tar:
        for path, arcname in bundle_paths:
            tar.add(path, arcname=arcname)

    return {'bundle_path': bundle_path}


@celery_app.task(name='workflow.generate_report')
def generate_report(analysis, predictor_events, bids_dir, run_ids,
                    sampling_rate, domain):
    _, _, bids_analysis = build_analysis(
        analysis, predictor_events, bids_dir, run_ids)
    outdir = Path('/file-data/reports') / analysis['hash_id']
    outdir.mkdir(exist_ok=True)

    first = bids_analysis.steps[0]
    results = {'design_matrix': [],
               'design_matrix_plot': [],
               'design_matrix_corrplot': []}

    hrf = [t for t in
           analysis['model']['Steps'][0]['Transformations']
           if t['Name'] == 'Convolve']

    for dm in first.get_design_matrix(
      mode='dense', force=True, entities=False, sampling_rate=sampling_rate):
        dense = impute_confounds(dm.dense)
        if hrf:
            dense = sort_dm(dense, interest=hrf[0]['Input'])

        builder = PathBuilder(outdir, domain, analysis['hash_id'], dm.entities)
        # Writeout design matrix
        out, url = builder.build('design_matrix', 'tsv')
        results['design_matrix'].append(url)
        dense.to_csv(out, index=False)

        dm_plot = plot_design_matrix(dense)
        results['design_matrix_plot'].append(dm_plot)

        corr_plot = plot_corr_matrix(dense)
        results['design_matrix_corrplot'].append(corr_plot)

    return results


@celery_app.task(name='neurovault.upload')
def upload(img_tarball, hash_id, access_token, timestamp=None,
           n_subjects=None):
    tmp_dir = Path(mkdtemp())
    # Untar:
    with tarfile.open(img_tarball) as tf:
        tf.extractall(tmp_dir)

    timestamp = "_" + timestamp if timestamp is not None else ''
    api = Client(access_token=access_token)

    try:
        collection = api.create_collection(
            '{}{}'.format(hash_id, timestamp))

        for img_path in tmp_dir.glob('*.nii.gz'):
            contrast_name = re.findall('contrast-(.*)_', str(img_path))[0]
            api.add_image(
                collection['id'], img_path, name=contrast_name,
                modality="fMRI-BOLD", map_type='T',
                analysis_level='G', cognitive_paradigm_cogatlas='None',
                number_of_subjects=n_subjects, is_valid=True)
    except:
        raise Exception(
            "Error uploading."
            " Perhaps a collection with the same name already exists?")

    return {'collection_id': collection['id']}
