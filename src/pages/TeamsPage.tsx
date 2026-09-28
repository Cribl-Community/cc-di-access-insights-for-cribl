import { useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Alert, EmptyState, Skeleton } from '@capra/core';
import { useRbacData } from '../context/RbacDataContext';
import { TEAM_FILTERS, isTeamFilterKey } from '../api/overview';
import { MasterDetailLayout } from '../components/MasterDetailLayout';
import { TeamList } from '../components/TeamList';
import { TeamDetail } from '../components/TeamDetail';
import './Page.css';

export function TeamsPage() {
  const { teamId } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { loading, error, teams, teamById, resolveTeamAccess } = useRbacData();
  const [query, setQuery] = useState('');

  const filterKey = searchParams.get('filter');
  const activeFilter = isTeamFilterKey(filterKey) ? filterKey : null;

  const filteredTeams = useMemo(() => {
    let list = teams;
    if (activeFilter) {
      list = list.filter((team) => TEAM_FILTERS[activeFilter].match(team, resolveTeamAccess));
    }
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter((team) =>
        [team.id, team.name, team.description].some((field) => field?.toLowerCase().includes(q)),
      );
    }
    return list;
  }, [teams, query, activeFilter, resolveTeamAccess]);

  if (loading) {
    return (
      <div className="page-status">
        <Skeleton active paragraph={{ rows: 6 }} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="page-status">
        <Alert appearance="danger" title="Couldn't load RBAC data">
          {error}
        </Alert>
      </div>
    );
  }

  const clearFilter = () => {
    const next = new URLSearchParams(searchParams);
    next.delete('filter');
    setSearchParams(next, { replace: true });
  };

  // Keep the active filter (query string) as the selection changes.
  const search = searchParams.toString();
  const selectTeam = (id: string) =>
    navigate(`/teams/${encodeURIComponent(id)}${search ? `?${search}` : ''}`);

  const selectedTeam = teamId ? teamById.get(teamId) : undefined;

  return (
    <MasterDetailLayout
      selectedKey={selectedTeam?.id}
      listLabel="Teams"
      list={
        <TeamList
          teams={filteredTeams}
          query={query}
          onQueryChange={setQuery}
          selectedTeamId={teamId}
          onSelect={selectTeam}
          filterLabel={activeFilter ? TEAM_FILTERS[activeFilter].label : undefined}
          onClearFilter={clearFilter}
        />
      }
      detail={
        selectedTeam ? (
          <TeamDetail team={selectedTeam} access={resolveTeamAccess(selectedTeam)} />
        ) : (
          <div className="detail-empty-wrapper">
            <EmptyState
              illustration="EmptyFolder"
              size="lg"
              title={teams.length === 0 ? 'No teams found' : 'Select a team'}
              description={
                teams.length === 0
                  ? 'No teams were returned for this Workspace.'
                  : 'Choose a team from the list to see the Roles it grants and who belongs to it.'
              }
            />
          </div>
        )
      }
    />
  );
}
