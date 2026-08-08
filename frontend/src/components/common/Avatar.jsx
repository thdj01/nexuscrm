import React, { useEffect, useState } from 'react';
import API from '../../api/axios';

export const getUserInitials = (name = '') => {
  const words = String(name || 'User').trim().split(/\s+/).filter(Boolean);

  if (words.length >= 2) {
    return `${words[0][0] || ''}${words[words.length - 1][0] || ''}`.toUpperCase() || 'U';
  }

  if (words.length === 1) {
    return words[0].slice(0, 2).toUpperCase() || 'U';
  }

  return 'U';
};

export const resolveAvatarSrc = (avatar = '') => {
  const value = String(avatar || '').trim();

  if (!value) return '';
  if (value.startsWith('blob:') || value.startsWith('data:')) return value;
  if (/^https?:\/\//i.test(value)) return value;
  if (value.startsWith('/')) return value;

  return `/${value}`;
};

const sizeClasses = {
  xs: 'h-6 w-6 text-[10px]',
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-12 w-12 text-base',
  xl: 'h-16 w-16 text-lg',
};

const Avatar = ({
  user,
  name,
  src,
  alt,
  size = 'sm',
  className = '',
  fallbackClassName = '',
  imageClassName = '',
}) => {
  const displayName = name || user?.name || user?.fullName || user?.email || 'User';
  const rawAvatarSrc = resolveAvatarSrc(src ?? user?.avatar ?? user?.profilePhoto ?? '');
  const [protectedAvatarSrc, setProtectedAvatarSrc] = useState('');
  const [imageBroken, setImageBroken] = useState(false);

  const protectedAvatarMatch = rawAvatarSrc.match(/^\/?uploads\/users\/([^/?#]+)$/i);
  const avatarSrc = protectedAvatarMatch ? protectedAvatarSrc : rawAvatarSrc;

  useEffect(() => {
    setImageBroken(false);
    setProtectedAvatarSrc('');

    if (!protectedAvatarMatch) return () => {};

    const controller = new AbortController();
    let objectUrl = '';
    API.get(`/auth/avatars/${encodeURIComponent(protectedAvatarMatch[1])}`, {
      responseType: 'blob',
      signal: controller.signal,
    })
      .then((response) => {
        if (controller.signal.aborted) return;
        objectUrl = URL.createObjectURL(response.data);
        setProtectedAvatarSrc(objectUrl);
      })
      .catch(() => {
        if (!controller.signal.aborted) setImageBroken(true);
      });

    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [rawAvatarSrc]);

  const baseClass = `inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full align-middle ${sizeClasses[size] || sizeClasses.sm} ${className}`;

  if (avatarSrc && !imageBroken) {
    return (
      <span className={baseClass} title={displayName}>
        <img
          src={avatarSrc}
          alt={alt || displayName}
          className={`h-full w-full rounded-full object-cover ${imageClassName}`}
          onError={() => setImageBroken(true)}
          loading="lazy"
        />
      </span>
    );
  }

  return (
    <span
      className={`${baseClass} bg-gradient-to-br from-blue-500 to-indigo-600 font-bold text-white ${fallbackClassName}`}
      title={displayName}
      aria-label={displayName}
    >
      {getUserInitials(displayName)}
    </span>
  );
};

export default Avatar;
