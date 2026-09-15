const assert = require('assert');

class CloudStateMachine {
  constructor() {
    this.state = 'LOCAL_ONLY';
    this.userEmail = null;
    this.token = null;
    this.pendingSync = false;
  }

  onSignInSuccess(email, token) {
    this.userEmail = email;
    this.token = token;
    this.state = 'CLOUD_CONNECTED';
    this.pendingSync = false;
  }

  onLogout() {
    this.userEmail = null;
    this.token = null;
    this.state = 'LOCAL_ONLY';
    this.pendingSync = false;
  }

  onNetworkOnline() {
    if (this.state === 'CLOUD_OFFLINE' && this.token) {
      this.state = 'CLOUD_CONNECTED';
    }
  }

  onNetworkOffline() {
    if (this.state === 'CLOUD_CONNECTED') {
      this.state = 'CLOUD_OFFLINE';
    }
  }

  onAuthError(status) {
    if (status === 401 || status === 403) {
      this.state = 'CLOUD_EXPIRED';
    }
  }

  onLocalChangeWhileOffline() {
    if (this.state === 'CLOUD_OFFLINE') {
      this.pendingSync = true;
    }
  }

  canAccessCloudView() {
    return this.state !== 'LOCAL_ONLY';
  }
}

describe('Cloud Account State Machine', () => {
  it('1. Initializes in LOCAL_ONLY state with no token', () => {
    const sm = new CloudStateMachine();
    assert.strictEqual(sm.state, 'LOCAL_ONLY');
    assert.strictEqual(sm.token, null);
    assert.strictEqual(sm.canAccessCloudView(), false);
  });

  it('2. Transitions to CLOUD_CONNECTED upon successful sign-in', () => {
    const sm = new CloudStateMachine();
    sm.onSignInSuccess('user@example.com', 'jwt-token-123');
    assert.strictEqual(sm.state, 'CLOUD_CONNECTED');
    assert.strictEqual(sm.userEmail, 'user@example.com');
    assert.strictEqual(sm.canAccessCloudView(), true);
  });

  it('3. Transitions to CLOUD_OFFLINE when network drops while connected', () => {
    const sm = new CloudStateMachine();
    sm.onSignInSuccess('user@example.com', 'jwt-token-123');
    sm.onNetworkOffline();
    assert.strictEqual(sm.state, 'CLOUD_OFFLINE');
    sm.onLocalChangeWhileOffline();
    assert.strictEqual(sm.pendingSync, true);
  });

  it('4. Reconnects to CLOUD_CONNECTED when network recovers', () => {
    const sm = new CloudStateMachine();
    sm.onSignInSuccess('user@example.com', 'jwt-token-123');
    sm.onNetworkOffline();
    assert.strictEqual(sm.state, 'CLOUD_OFFLINE');
    sm.onNetworkOnline();
    assert.strictEqual(sm.state, 'CLOUD_CONNECTED');
  });

  it('5. Transitions to CLOUD_EXPIRED on HTTP 401/403 authorization error', () => {
    const sm = new CloudStateMachine();
    sm.onSignInSuccess('user@example.com', 'jwt-token-123');
    sm.onAuthError(401);
    assert.strictEqual(sm.state, 'CLOUD_EXPIRED');
  });

  it('6. Transitions to LOCAL_ONLY on explicit logout and clears credentials', () => {
    const sm = new CloudStateMachine();
    sm.onSignInSuccess('user@example.com', 'jwt-token-123');
    sm.onLogout();
    assert.strictEqual(sm.state, 'LOCAL_ONLY');
    assert.strictEqual(sm.token, null);
    assert.strictEqual(sm.canAccessCloudView(), false);
  });
});
