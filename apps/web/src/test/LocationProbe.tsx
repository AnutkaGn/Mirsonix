import { useLocation } from 'react-router-dom';

/** Shows the current address, so a test can assert what a click did to the URL. */
export function LocationProbe() {
  const location = useLocation();
  return <span data-testid="location">{`${location.pathname}${location.search}`}</span>;
}
