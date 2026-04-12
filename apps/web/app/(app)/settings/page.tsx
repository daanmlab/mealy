'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/auth';
import { usersApi, type FoodGoal, type CookTimePreference } from '@/lib/api';
import { useWeekStartDay } from '@/hooks/useWeekStartDay';
import { DISLIKES_OPTIONS, GOALS, COOK_TIMES } from '@/lib/constants';

export default function SettingsPage() {
  const { user, logout, refreshUser } = useAuth();
  const { weekStartsOn, setWeekStartsOn } = useWeekStartDay();

  // ── Preferences ────────────────────────────────────────────────────────────
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [peopleCount, setPeopleCount] = useState(user?.peopleCount ?? 2);
  const [mealsPerWeek, setMealsPerWeek] = useState(user?.mealsPerWeek ?? 5);
  const [cookTime, setCookTime] = useState<CookTimePreference>(user?.cookTime ?? 'under40');
  const [goal, setGoal] = useState<FoodGoal>(user?.goal ?? 'healthy');
  const [dislikes, setDislikes] = useState<string[]>(user?.dislikes ?? []);

  // ── Profile ─────────────────────────────────────────────────────────────────
  const [name, setName] = useState(user?.name ?? '');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);
  const [profileError, setProfileError] = useState('');

  // ── Change password ─────────────────────────────────────────────────────────
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordSaved, setPasswordSaved] = useState(false);
  const [passwordError, setPasswordError] = useState('');

  // ── Delete account ──────────────────────────────────────────────────────────
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  function toggleDislike(item: string) {
    setDislikes((prev) => (prev.includes(item) ? prev.filter((d) => d !== item) : [...prev, item]));
  }

  async function handleSavePreferences() {
    setSaving(true);
    try {
      await usersApi.updatePreferences({ peopleCount, mealsPerWeek, cookTime, goal, dislikes });
      await refreshUser();
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveProfile() {
    setProfileSaving(true);
    setProfileError('');
    try {
      await usersApi.updateProfile({ name: name.trim() || undefined });
      await refreshUser();
      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 2000);
    } catch {
      setProfileError('Failed to update profile.');
    } finally {
      setProfileSaving(false);
    }
  }

  async function handleChangePassword() {
    setPasswordSaving(true);
    setPasswordError('');
    try {
      await usersApi.changePassword({ currentPassword, newPassword });
      setCurrentPassword('');
      setNewPassword('');
      setPasswordSaved(true);
      setTimeout(() => setPasswordSaved(false), 2000);
    } catch {
      setPasswordError('Current password is incorrect.');
    } finally {
      setPasswordSaving(false);
    }
  }

  async function handleDeleteAccount() {
    setDeleting(true);
    try {
      await usersApi.deleteAccount();
      await logout();
    } finally {
      setDeleting(false);
    }
  }

  if (!user) return null;

  return (
    <div className="space-y-8">
      <h1 className="text-xl font-bold text-gray-900">Settings</h1>

      {/* ── Profile ──────────────────────────────────────────────────────── */}
      <section className="bg-white rounded-xl border border-gray-100 p-6 space-y-4">
        <h2 className="font-semibold text-gray-900">Profile</h2>
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-full bg-olive-subtle flex items-center justify-center text-olive font-bold">
            {user.name?.[0]?.toUpperCase() ?? user.email[0]?.toUpperCase() ?? '?'}
          </div>
          <p className="text-sm text-gray-500">{user.email}</p>
        </div>
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1">Display name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-olive"
            placeholder="Your name"
          />
        </div>
        {profileError && <p className="text-red-600 text-sm">{profileError}</p>}
        <button
          onClick={handleSaveProfile}
          disabled={profileSaving}
          className="px-6 py-2.5 bg-olive text-white rounded-xl text-sm font-semibold hover:bg-olive-dark disabled:opacity-50 transition-colors"
        >
          {profileSaved ? '✓ Saved' : profileSaving ? 'Saving…' : 'Save profile'}
        </button>
      </section>

      {/* ── Preferences ──────────────────────────────────────────────────── */}
      <section className="bg-white rounded-xl border border-gray-100 p-6 space-y-5">
        <h2 className="font-semibold text-gray-900">Preferences</h2>

        <div>
          <label className="text-sm font-medium text-gray-700 block mb-2">People cooking for</label>
          <div className="flex gap-2">
            {[1, 2, 3, 4].map((n) => (
              <button
                key={n}
                onClick={() => setPeopleCount(n)}
                className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                  peopleCount === n ? 'border-olive bg-olive-subtle text-olive' : 'border-gray-200 text-gray-600'
                }`}
              >
                {n === 4 ? '4+' : n}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700 block mb-2">Dinners per week</label>
          <div className="flex gap-2">
            {[3, 4, 5, 7].map((n) => (
              <button
                key={n}
                onClick={() => setMealsPerWeek(n)}
                className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                  mealsPerWeek === n ? 'border-olive bg-olive-subtle text-olive' : 'border-gray-200 text-gray-600'
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700 block mb-2">Meal goal</label>
          <div className="flex flex-wrap gap-2">
            {GOALS.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => setGoal(value)}
                className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                  goal === value ? 'border-olive bg-olive-subtle text-olive' : 'border-gray-200 text-gray-600'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700 block mb-2">Cook time</label>
          <div className="flex gap-2">
            {COOK_TIMES.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => setCookTime(value)}
                className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                  cookTime === value ? 'border-olive bg-olive-subtle text-olive' : 'border-gray-200 text-gray-600'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700 block mb-2">Week starts on</label>
          <div className="flex gap-2">
            {([1, 0] as const).map((day) => (
              <button
                key={day}
                onClick={() => setWeekStartsOn(day)}
                className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                  weekStartsOn === day ? 'border-olive bg-olive-subtle text-olive' : 'border-gray-200 text-gray-600'
                }`}
              >
                {day === 1 ? 'Monday' : 'Sunday'}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700 block mb-2">Ingredients to avoid</label>
          <div className="flex flex-wrap gap-2">
            {DISLIKES_OPTIONS.map((item) => (
              <button
                key={item}
                onClick={() => toggleDislike(item)}
                className={`px-3 py-1.5 rounded-full border text-sm font-medium capitalize transition-colors ${
                  dislikes.includes(item) ? 'border-red-400 bg-red-50 text-red-700' : 'border-gray-200 text-gray-600'
                }`}
              >
                {item}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={handleSavePreferences}
          disabled={saving}
          className="px-6 py-2.5 bg-olive text-white rounded-xl text-sm font-semibold hover:bg-olive-dark disabled:opacity-50 transition-colors"
        >
          {saved ? '✓ Saved' : saving ? 'Saving…' : 'Save preferences'}
        </button>
      </section>

      {/* ── Change password ───────────────────────────────────────────────── */}
      {!user.avatarUrl && (
        <section className="bg-white rounded-xl border border-gray-100 p-6 space-y-4">
          <h2 className="font-semibold text-gray-900">Change password</h2>
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Current password</label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-olive"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">New password</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-olive"
            />
          </div>
          {passwordError && <p className="text-red-600 text-sm">{passwordError}</p>}
          <button
            onClick={handleChangePassword}
            disabled={passwordSaving || !currentPassword || newPassword.length < 8}
            className="px-6 py-2.5 bg-olive text-white rounded-xl text-sm font-semibold hover:bg-olive-dark disabled:opacity-50 transition-colors"
          >
            {passwordSaved ? '✓ Password changed' : passwordSaving ? 'Saving…' : 'Change password'}
          </button>
        </section>
      )}

      {/* ── Account actions ───────────────────────────────────────────────── */}
      <section className="bg-white rounded-xl border border-gray-100 p-6 space-y-4">
        <h2 className="font-semibold text-gray-900">Account</h2>
        <button
          onClick={() => {
            void logout();
          }}
          className="text-sm text-gray-500 hover:text-gray-700 transition-colors block"
        >
          Sign out
        </button>
        {!deleteConfirm ? (
          <button
            onClick={() => setDeleteConfirm(true)}
            className="text-sm text-red-500 hover:text-red-700 transition-colors block"
          >
            Delete account…
          </button>
        ) : (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-3">
            <p className="text-sm text-red-700 font-medium">
              This will permanently delete your account and all data. This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleDeleteAccount}
                disabled={deleting}
                className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {deleting ? 'Deleting…' : 'Yes, delete my account'}
              </button>
              <button
                onClick={() => setDeleteConfirm(false)}
                className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
