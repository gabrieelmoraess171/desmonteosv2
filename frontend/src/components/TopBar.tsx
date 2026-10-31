import React, { useState } from 'react';
import { Search, Bell, PlusCircle, UserCircle } from 'lucide-react';

interface TopBarProps {
  title: string;
}

export default function TopBar({ title }: TopBarProps) {
  const [search, setSearch] = useState('');

  return (
    <div className="h-16 bg-card border-b border-line px-6 flex items-center justify-between">
      
      {/* Left - Page Title */}
      <div>
        <div>
          <p className="app-breadcrumb">Desmonte OS <span>/</span> {title}</p>
          <h1 className="text-2xl font-bold text-ink">{title}</h1>
        </div>
      </div>

      {/* Right - Actions */}
      <div className="flex items-center space-x-4">
        
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted" />
          <input
            type="text"
            placeholder="Buscar SKU, nome, OEM..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-secondary border border-line rounded-lg pl-10 pr-4 py-2 text-sm text-ink placeholder:text-muted w-64 focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </div>

        {/* Notifications */}
        <button className="relative p-2 hover:bg-surface rounded-lg">
          <Bell className="h-5 w-5 text-muted" />
          <span className="absolute -top-1 -right-1 h-5 w-5 bg-danger text-white text-xs rounded-full flex items-center justify-center">
            3
          </span>
        </button>

        {/* New Piece */}
        <button className="bg-accent text-white px-4 py-2 rounded-lg hover:brightness-110 flex items-center space-x-2">
          <PlusCircle className="h-4 w-4" />
          <span>Nova Peça</span>
        </button>

        {/* Profile */}
        <button className="p-2 hover:bg-surface rounded-lg">
          <UserCircle className="h-6 w-6 text-muted" />
        </button>
      </div>
    </div>
  );
}
