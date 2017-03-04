import sys
sys.path.insert(0, "../")
from fmri_bids_firstlevel import FirstLevelBIDS


class TT(FirstLevelBIDS):
    def validate_arguments(self, args):
        args['task'] = 'emotionalregulation'
        super(Basic, self).validate_arguments(args)

        self.arguments['mask'] = '/home/zorro/datasets/ds009/derivatives/fmriprep/sub-01/func/sub-01_task-emotionalregulation_run-01_bold_space-MNI152NLin2009cAsym_brainmask.nii.gz'
        self.arguments['TR'] = 2
