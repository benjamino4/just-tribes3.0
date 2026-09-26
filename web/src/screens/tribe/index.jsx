import React from 'react';
import { useParams, Navigate } from 'react-router-dom';
import Kiva from './Kiva.jsx';
import Pyre from './Pyre.jsx';
import Elections from './Elections.jsx';
import WarRoom from './WarRoom.jsx';
import Members from './Members.jsx';

const MAP = { kiva: Kiva, pyre: Pyre, elections: Elections, war: WarRoom, members: Members };

export default function TribeSub() {
  const { id } = useParams();
  const Cmp = MAP[id];
  if (!Cmp) return <Navigate to="/tribe" replace />;
  return <Cmp />;
}
