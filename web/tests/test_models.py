import pytest
from models import (Analysis, User, Dataset, Predictor, Stimulus, Run,
					RunStimulus, Result, ExtractedFeature, ExtractedEvent)

def test_dataset_ingestion(session, add_dataset):
	# Number of entries
	assert Dataset.query.count() == 1
	dataset_model = Dataset.query.filter_by(id=add_dataset).one()

	# Try adding dataset without a name
	with pytest.raises(Exception) as excinfo:
		session.add(Dataset())
		session.commit()
	assert 'not-null constraint' in str(excinfo)
	session.rollback()

	# Test properties of Run
	assert Run.query.count() == dataset_model.runs.count() == 2
	run_model =  dataset_model.runs.first()
	assert run_model.dataset_id == dataset_model.id

	# Test properties of first run's predictors
	assert run_model.predictors.count() == 12
	assert Predictor.query.count() == 24 # because two runs total

	run_predictor = run_model.predictors.first()
	run_predictor.name == 'iaps_id'
	assert run_predictor.predictor_events.count() == 60

	# Test predictor event
	predictor_event = run_predictor.predictor_events.first()
	assert predictor_event.value is not None
	assert predictor_event.onset is not None

	# Test that Stimiuli were extracted
	Stimulus.query.count() == 47

	# and that they were associated with runs
	RunStimulus.query.count() == 51


def test_extracted_features(extract_features):
	assert ExtractedFeature.query.count() == 2

	extractor_names = [ee.extractor_name for ee in ExtractedFeature.query.all()]
	assert ['BrightnessExtractor', 'VibranceExtractor'] == extractor_names

	ef = ExtractedFeature.query.first()
	# Check that the number of features extracted is the same as Stimuli
	assert ef.extracted_events.count() == Stimulus.query.count()

	# And that a sensical value was extracted
	assert ef.extracted_events.first().value < 1


# def test_analysis(session, add_analyses, add_predictor):
# 	# Number of entries
# 	assert Analysis.query.count() == 2
#
# 	first_analysis = Analysis.query.first()
# 	assert User.query.filter_by(id=first_analysis.user_id).count() == 1
#
# 	# Add relationship to a predictor
# 	# pred = Predictor.query.filter_by(id = add_predictor).one()
# 	# first_analysis.predictors = [pred]
# 	# session.commit()
# 	# assert Predictor.query.filter_by(id = add_predictor).one().analysis_id \
# 	# 	== first_analysis.id
#
# 	# Try adding analysis without a name
# 	with pytest.raises(Exception) as excinfo:
# 		session.add(Analysis())
# 		session.commit()
# 	assert 'not-null constraint' in str(excinfo)
# 	session.rollback()
#
# 	# Try cloning analysis
# 	clone = first_analysis.clone()
# 	session.add(clone)
# 	session.commit()
#
# 	assert clone.id > first_analysis.id
# 	assert clone.name == first_analysis.name
#
# def test_result(add_result):
# 	assert Result.query.count() == 1
