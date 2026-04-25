import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ProfileGuard from './ProfileGuard';
import * as AuthContext from '../contexts/AuthContext';

function renderGuard(authOverrides) {
  vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
    user: { uid: 'u1' },
    loading: false,
    profileLoading: false,
    isProfileComplete: () => true,
    ...authOverrides,
  });
  return render(
    <MemoryRouter>
      <ProfileGuard><span>protected</span></ProfileGuard>
    </MemoryRouter>
  );
}

describe('ProfileGuard', () => {
  it('renders nothing while profileLoading is true', () => {
    const { container } = renderGuard({ profileLoading: true, isProfileComplete: () => false });
    expect(container.firstChild).toBeNull();
  });

  it('renders children when profile is complete', () => {
    renderGuard({ isProfileComplete: () => true });
    expect(screen.getByText('protected')).toBeInTheDocument();
  });

  it('shows complete-profile prompt when profile is incomplete and not loading', () => {
    renderGuard({ isProfileComplete: () => false });
    expect(screen.getByText(/complete profile/i)).toBeInTheDocument();
  });
});
