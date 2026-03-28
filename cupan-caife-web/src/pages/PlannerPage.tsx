import { Navigate } from 'react-router-dom';

export default function PlannerPage() {
  return <Navigate to="/map?mode=culture" replace />;
}
