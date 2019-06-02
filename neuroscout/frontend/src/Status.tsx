import * as React from 'react';
import { Alert, Button, Card, Checkbox, Modal, Tag, Icon, Tooltip, Switch } from 'antd';
import { config } from './config';
import { displayError, jwtFetch, alphaSort, timeout } from './utils';
import { ApiAnalysis, Analysis } from './coretypes';
import { api } from './api';

const domainRoot = config.server_url;

export class Status extends React.Component<{status?: string, analysisId?: string}, {}> {
  render() {
    let { analysisId, status } = this.props;
    if (status === undefined) {
      status = 'DRAFT';
    }
    const color: string = {
      DRAFT: 'blue',
      PENDING: 'orange',
      FAILED: 'red',
      PASSED: 'green'
    }[status];

    return(
      <span>
        <Tag color={color}>
          {status === 'DRAFT' ? <Icon type="unlock" /> : <Icon type="lock" />}
          {' ' + status}
        </Tag>
      </span>
    );
  }
}

export class DLLink extends React.Component<{status?: string, analysisId?: string}, {}> {
    render() {
      let { analysisId, status } = this.props;
      if (status === undefined) {
        status = 'DRAFT';
      }

      let bundleLink;
      if (status === 'PASSED' && analysisId) {
        bundleLink = `${domainRoot}/analyses/${analysisId}_bundle.tar.gz`;
      }

      return(
          <span>
            <a href={bundleLink}>Download</a>
          </span>
      );
    }
}

type PubAccessProps = {
  private: boolean | undefined,
  updateAnalysis: (value: Partial<Analysis>, unsavedChanges: boolean, save: boolean) => void
};
class PubAccess extends React.Component<PubAccessProps, {}> {
  render() {
    return (
      <Tooltip title="Should this analysis be private (only visible to you) or public?">
        <Switch
          checked={!this.props.private}
          checkedChildren="Public"
          unCheckedChildren="Private"
          onChange={checked => this.props.updateAnalysis({'private': !checked}, false, true)}
        />
      </Tooltip>
    );
  }
}

type submitProps = {
  status?: string,
  analysisId?: string,
  confirmSubmission: (build: boolean) => void,
  private: boolean,
  updateAnalysis?: (value: Partial<Analysis>) => void,
  userOwns?: boolean
};

export class Submit extends React.Component<submitProps, {tosAgree: boolean, validate: boolean}> {
  constructor(props) {
    super(props);

    this.state = {
      tosAgree: (this.props.status !== 'DRAFT'),
      validate: true
    };
  }

  onChange(e) {
    this.setState({tosAgree: e.target.checked});
  }

  validateChange(e) {
    let setState = this.setState.bind(this);
    if (!e.target.checked) {
      Modal.confirm({
        title: 'Disable validation of model?',
        content: `Disabling validation of the model will speed up bundle generation
          but can lead to unexpected errors at runtime. Use at your own risk!`,
        onOk() {
          setState({validate: e.target.checked});
        }
      });
    } else {
      this.setState({validate: e.target.checked});
    }
  }

  render() {
    let { analysisId, status } = this.props;
    if (status === undefined) {
      status = 'DRAFT';
    }
    let onChange = this.onChange.bind(this);
    let validateChange = this.validateChange.bind(this);
    return(
      <div>
        <h3>Terms for analysis generation:</h3>
        <ul>
          <li>I agree that once I submit my analysis, I will not be able to delete or edit it.</li>
          <li>I agree if I publish results stemming from this analysis,
          I must make public, and cite all relevant analyses.</li>
          <li> I understand that the statistical maps generated by this analysis will be 
          automatically uploaded to the NeuroVault website by default (users may opt-out at run-time).</li>
            {this.props.private &&
            <li>
              I understand that although my analysis is currently private, anyone with the analysis
              ID may view this analysis, and subsequent uploaded results.
            </li>
            }
            {!this.props.private &&
          <li>
              I understand that my analysis is currently public and will be searchable by other users.
          </li>
            }
        </ul>
        <Checkbox onChange={validateChange} checked={this.state.validate}>
          Validate design matrix construction for all runs (reduces the chance of run-time errors, but can
          substantially increase bundle compilation time.)
        </Checkbox>
        <br/>
        <Checkbox onChange={onChange} checked={this.state.tosAgree}>
          I have read and agree to Neuroscout's terms of service
        </Checkbox>
        <br/>
        <Button
          hidden={!this.props.analysisId}
          onClick={this.props.confirmSubmission.bind(this, this.state.validate)}
          type={'primary'}
          disabled={!this.state.tosAgree || !['DRAFT', 'FAILED'].includes(status)}
        >
          Generate
        </Button>
      </div>
    );
  }
}

type statusTabState = {
  compileTraceback: string,
  nvUploads?: any
};
export class StatusTab extends React.Component<submitProps, statusTabState> {
  constructor(props) {
    super(props);
    this.state = {
      compileTraceback: '',
    };
    if ((this.props.analysisId !== undefined)) {
      this.getTraceback(this.props.analysisId);
      api.getNVUploads(this.props.analysisId).then(nvUploads => {
        if (nvUploads !== null) {
          this.setState({nvUploads: nvUploads});
        }
     });
    }
  }

  getTraceback(id) {
      if (id === undefined) {
        return;
      }
      jwtFetch(`${domainRoot}/api/analyses/${id}/compile`)
      .then((res) => {
        if (res.compile_traceback) {
          this.setState({compileTraceback: res.compile_traceback});
        }
      });
  }

  componentWillReceiveProps(nextProps: submitProps) {
    if ((nextProps.status !== this.props.status) && (nextProps.status === 'FAILED')) {
      this.getTraceback(nextProps.analysisId);
    }
    if ((nextProps.analysisId !== this.props.analysisId && nextProps.analysisId !== undefined)) {
      this.getTraceback(nextProps.analysisId);
      api.getNVUploads(nextProps.analysisId).then(nvUploads => {
        if (nvUploads !== null) {
          this.setState({nvUploads: nvUploads});
        }
      });
    }
  }

  nvLink(collection_id: any) {
    let url = `https://neurovault.org/collections/${collection_id}`;
    return (
      <a href={url}>
        https://neurovault.org/collections/{collection_id}/
      </a>
    );
  }

  render() {
    return(
      <div>
      <div className="statusHeader">
        {this.props.userOwns &&
          <>
          <PubAccess private={this.props.private} updateAnalysis={this.props.updateAnalysis!} />
          <span>{' '}</span>
          </>}
        <Status status={this.props.status} analysisId={this.props.analysisId} />
      </div>
      {(this.props.status === 'PASSED') &&
        <div>
          <h3>Analysis Passed</h3>
          <p>
            {this.props.userOwns && 'Congratulations!'} The analysis is finished compiling and is ready to be executed.
            Once you have installed Docker you may run the analysis with the following command,
            replacing '/local/directory' with a directory on your computer:
          </p>
          <pre>
            <code>
              docker run --rm -it -v /local/outputdirectory:/out
              neuroscout/neuroscout-cli run /out {this.props.analysisId}
            </code>
          </pre>
          <p>
            See the <a href="https://github.com/neuroscout/neuroscout-cli">neuroscout-cli documentation </a>
             for more information on how to install and run analyses.
          </p>
        </div>
      }
      {(this.props.status === 'FAILED') &&
        <div>
          <h3>Analysis Failed to Compile</h3>
          <p>
            Oh no! It looks like your analysis failed to compile.
            Once you make changes to fix the analysis you can re-run it below.
            If the issue remains, please file a
            <a href="https://github.com/neuroscout/neuroscout/issues"> bugreport</a>.
          </p>
          <Card title="Errors" key="errors">
            <pre>{this.state.compileTraceback}</pre>
          </Card>
        </div>
      }
      {(this.props.status === 'DRAFT' || this.props.status === 'FAILED') &&
        <Submit
          status={this.props.status}
          analysisId={this.props.analysisId}
          confirmSubmission={this.props.confirmSubmission}
          private={this.props.private}
        />
      }
      {(this.props.status === 'PENDING' || this.props.status === 'SUBMITTING') &&
        <div>
          <h3>Analysis Pending Generation</h3>
          <p>Analysis generation may take some time. This page will update when complete.</p>
        </div>
      }
      {(this.state.nvUploads) &&
        <div>
        <h3>NeuroVault Uploads</h3>
        {(this.state.nvUploads.pending) &&
          <Alert
            message="Latest Attempted Upload:"
            description={`${this.state.nvUploads.pending.uploaded_at}`}
            type="warning"
          />
        }
        {(this.state.nvUploads.ok) &&
          this.state.nvUploads.ok.map((x, i) => {
            return (<Alert
              key={x.collection_id}
              message={this.nvLink(x.collection_id)}
              description={`Uploaded at: ${x.uploaded_at}`}
              type="success"
            />);
          })
        }
        {(this.state.nvUploads.failed) &&
          <Alert
            message="Last failed upload:"
            description={`Failed at ${this.state.nvUploads.failed.uploaded_at}
              <br/>${this.state.nvUploads.failed.traceback}`}
            type="error"
          />
        }
        </div>
      }
      {this.props.children}
      </div>
    );
  }
}
