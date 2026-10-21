import React from 'react';
import {
  useLocation,
  useNavigate,
  useParams,
  Location,
  NavigateFunction,
  Params,
} from 'react-router-dom';

export interface WithRouterProps {
  location: Location;
  navigate: NavigateFunction;
  params: Params;
}

export function withRouter<P extends object>(
  Component: React.ComponentType<P & WithRouterProps>
) {
  return function ComponentWithRouterProp(props: P) {
    const location = useLocation();
    const navigate = useNavigate();
    const params = useParams();

    return (
      <Component
        {...props}
        location={location}
        navigate={navigate}
        params={params}
      />
    );
  };
}

