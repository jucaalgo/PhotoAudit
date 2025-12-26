import React from 'react';
import { Link, useLocation } from 'react-router-dom';

const GlobalNav = () => {
    const location = useLocation();

    const getLinkClass = (path: string) => {
        const isActive = location.pathname === path;
        return `p-2 rounded tooltip transition-colors ${isActive ? 'bg-primary text-white shadow-lg shadow-primary/40' : 'text-white/60 hover:text-white hover:bg-white/10'
            }`;
    };

    return (
        <nav className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] bg-[#1a202c]/90 backdrop-blur border border-border-dark px-2 py-2 rounded-xl shadow-2xl flex gap-1 animate-fade-in-up">
            <Link to="/" className={getLinkClass("/")} title="Dashboard">
                <span className="material-symbols-outlined">dashboard</span>
            </Link>
            <Link to="/config" className={getLinkClass("/config")} title="Config">
                <span className="material-symbols-outlined">settings</span>
            </Link>
            <Link to="/telemetry" className={getLinkClass("/telemetry")} title="Telemetry">
                <span className="material-symbols-outlined">analytics</span>
            </Link>
            <Link to="/transition" className={getLinkClass("/transition")} title="Transition">
                <span className="material-symbols-outlined">compare</span>
            </Link>
            <Link to="/console" className={getLinkClass("/console")} title="Console">
                <span className="material-symbols-outlined">terminal</span>
            </Link>
            <Link to="/export" className={getLinkClass("/export")} title="Export">
                <span className="material-symbols-outlined">output</span>
            </Link>
        </nav>
    );
};

export default GlobalNav;