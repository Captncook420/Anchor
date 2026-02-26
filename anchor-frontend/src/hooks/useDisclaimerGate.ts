import { useLocalStorage } from './useLocalStorage';
import { DISCLAIMER_KEY } from '../utils/constants';

export function useDisclaimerGate(): [boolean, () => void] {
  const [accepted, setAccepted] = useLocalStorage(DISCLAIMER_KEY, false);

  const accept = () => {
    setAccepted(true);
  };

  return [accepted, accept];
}
