/*
Resuable AnalysisList component used for displaying a list of analyses, e.g. on
the home page or on the 'browse public analysis' page
*/
import * as React from 'react'
import { Button, Row, Table, Input } from 'antd'
import { MainCol, Space, StatusTag } from './HelperComponents'
import { AppAnalysis, Dataset } from './coretypes'
import { Link, Redirect } from 'react-router-dom'

import memoize from 'memoize-one'

const tableLocale = {
  filterConfirm: 'Ok',
  filterReset: 'Reset',
  emptyText: 'No Analyses',
}

export interface AnalysisListProps {
  loggedIn?: boolean
  publicList?: boolean
  analyses: AppAnalysis[] | null
  cloneAnalysis: (id: string) => Promise<string>
  onDelete?: (analysis: AppAnalysis) => void
  children?: React.ReactNode
  datasets: Dataset[]
  loading?: boolean
  showOwner?: boolean
}

export class AnalysisListTable extends React.Component<
  AnalysisListProps,
  { redirectId: string; owners: string[]; searchText: string }
> {
  state = { redirectId: '', owners: [], searchText: '' }

  componentDidUpdate(prevProps) {
    const length = prevProps.analyses ? prevProps.analyses.length : 0
    if (
      this.props.showOwner &&
      this.props.analyses &&
      length !== this.props.analyses.length
    ) {
      const owners = new Set(
        this.props.analyses.filter(x => x.user_name).map(x => x.user_name),
      )
      this.setState({ owners: [...owners] as string[] })
    }
  }

  onInputChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    this.setState({ searchText: e.target.value })
  }

  applySearch = memoize((searchText, length) => {
    if (searchText.length < 2 || !this.props.analyses) {
      return this.props.analyses
    }
    return this.props.analyses.filter(
      x => x.name.includes(searchText) || x.dataset_name.includes(searchText),
    )
  })
  render() {
    if (this.state.redirectId !== '') {
      return <Redirect to={'/builder/' + this.state.redirectId} />
    }
    const {
      analyses,
      datasets,
      publicList,
      cloneAnalysis,
      onDelete,
      showOwner,
    } = this.props

    const datasetFilters = datasets.map(x => {
      return { text: x.name, value: x.name }
    })

    // Define columns of the analysis table
    // Open link: always (opens analysis in Builder)
    // Delete button: only if not a public list and analysis is in draft mode
    // Clone button: any analysis
    const analysisTableColumns: any[] = [
      {
        title: 'ID',
        dataIndex: 'id',
        sorter: (a, b) => a.id.localeCompare(b.id),
      },
      {
        title: 'Name',
        render: (text, record: AppAnalysis) => (
          <Link to={`/builder/${record.id}`}>
            <div className="recordName">
              {record.name ? record.name : 'Untitled'}
            </div>
          </Link>
        ),
        sorter: (a, b) => a.name.localeCompare(b.name),
      },
      {
        title: 'Status',
        dataIndex: 'status',
        render: (text, record) => <StatusTag status={record.status} />,
        sorter: (a, b) => a.status.localeCompare(b.status),
      },
      {
        title: 'Modified at',
        dataIndex: 'modified_at',
        defaultSortOrder: 'descend' as const,
        sorter: (a, b) => a.modified_at.localeCompare(b.modified_at),
        render: text => {
          const date = text.split('-')
          return (
            <>
              {date[2].slice(0, 2)}-{date[1]}-{date[0].slice(2, 4)}
            </>
          )
        },
      },
      {
        title: 'Dataset',
        dataIndex: 'dataset_name',
        sorter: (a, b) => a.dataset_name.localeCompare(b.dataset_name),
        filters: datasetFilters,
        onFilter: (value, record) => record.dataset_name === value,
      },
    ]

    if (showOwner) {
      analysisTableColumns.push({
        title: 'Author',
        dataIndex: 'user_name',
        sorter: (a, b) =>
          String(a.user_name).localeCompare(String(b.user_name)),
        render: (text, record) => (
          <Link to={`/profile/${String(record.user_name)}`}>
            {' '}
            {record.user_name}{' '}
          </Link>
        ),
        filters: this.state.owners.map(x => {
          return { text: x, value: x }
        }),
        onFilter: (value, record) => record.user_name === value,
      })
    }

    if (publicList) {
      analysisTableColumns.splice(2, 1)
    }

    if (this.props.loggedIn) {
      analysisTableColumns.push({
        title: 'Actions',
        render: (text, record: AppAnalysis) => (
          <span>
            {record.status === 'PASSED' && (
              <>
                <Button
                  type="primary"
                  ghost
                  onClick={() => {
                    void this.props.cloneAnalysis(record.id).then(id => {
                      this.setState({ redirectId: id })
                    })
                  }}>
                  Clone
                </Button>
                <Space />
              </>
            )}
            {!publicList && ['DRAFT', 'FAILED'].includes(record.status) && (
              <Button danger ghost onClick={() => onDelete!(record)}>
                Delete
              </Button>
            )}
          </span>
        ),
      })
    }
    const length = analyses ? analyses.length : 0
    const dataSource = this.applySearch(this.state.searchText, length)

    return (
      <div>
        <Input
          placeholder="Search predictor name or description..."
          value={this.state.searchText}
          onChange={this.onInputChange}
        />
        <Table
          columns={analysisTableColumns}
          rowKey="id"
          size="small"
          dataSource={dataSource === null ? [] : dataSource}
          loading={analyses === null || !!this.props.loading}
          expandedRowRender={record => <p>{record.description}</p>}
          pagination={
            analyses !== null && analyses.length > 20
              ? { position: ['bottomRight'] }
              : false
          }
          locale={tableLocale}
        />
      </div>
    )
  }
}

// wrap table in components for use by itself as route
const AnalysisList = (props: AnalysisListProps) => {
  return (
    <div>
      <Row justify="center">
        <MainCol>
          <h3>
            {props.publicList ? 'Public analyses' : 'Your saved analyses'}
          </h3>
          <br />
          <AnalysisListTable {...props} />
        </MainCol>
      </Row>
    </div>
  )
}

export default AnalysisList
