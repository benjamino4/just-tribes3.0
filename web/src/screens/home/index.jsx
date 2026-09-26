import React from 'react';
import { useParams, Navigate } from 'react-router-dom';
import StreakPage from './StreakPage.jsx';
import AshPage from './AshPage.jsx';
import QuestsPage from './QuestsPage.jsx';
import TrialsPage from './TrialsPage.jsx';
import SpinPage from './SpinPage.jsx';

const MAP = { streak: StreakPage, ash: AshPage, quests: QuestsPage, trials: TrialsPage, spin: SpinPage };

export default function HomeSub() {
  const { id } = useParams();
  const Cmp = MAP[id];
  if (!Cmp) return <Navigate to="/" replace />;
  return <Cmp />;
}
