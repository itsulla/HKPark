'use client';

import { useState, useCallback, useEffect } from 'react';
import { useGameStore } from '../state/gameStore';
import { ToolType } from '../engine/types';
import RidePicker from './RidePicker';
import ShopPicker from './ShopPicker';
import StaffPicker from './StaffPicker';

interface ToolButton {
  tool: ToolType | null;
  icon: string;
  label: string;
  shortcut: string;
  opensSubmenu?: 'rides' | 'shops' | 'staff';
  opensModal?: 'finance' | 'districts';
}

const toolButtons: ToolButton[] = [
  { tool: ToolType.SELECT, icon: '\uD83D\uDD0D', label: 'Select', shortcut: '1' },
  { tool: ToolType.BUILD_PATH, icon: '\uD83D\uDEE4\uFE0F', label: 'Path', shortcut: '2' },
  { tool: ToolType.PLACE_RIDE, icon: '\uD83C\uDFA2', label: 'Rides', shortcut: '3', opensSubmenu: 'rides' },
  { tool: ToolType.PLACE_SHOP, icon: '\uD83C\uDFEA', label: 'Shops', shortcut: '4', opensSubmenu: 'shops' },
  { tool: ToolType.PLACE_DECORATION, icon: '\uD83C\uDF33', label: 'Decor', shortcut: '5' },
  { tool: ToolType.DEMOLISH, icon: '\uD83D\uDD28', label: 'Demolish', shortcut: '6' },
  { tool: null, icon: '\uD83D\uDC65', label: 'Staff', shortcut: '7', opensSubmenu: 'staff' },
  { tool: null, icon: '\uD83D\uDCCA', label: 'Finance', shortcut: '', opensModal: 'finance' },
  { tool: null, icon: '\uD83D\uDDFA\uFE0F', label: 'Districts', shortcut: '', opensModal: 'districts' },
];

interface ToolbarProps {
  onOpenFinance: () => void;
  onOpenDistricts: () => void;
}

export default function Toolbar({ onOpenFinance, onOpenDistricts }: ToolbarProps) {
  const selectedTool = useGameStore((s) => s.selectedTool);
  const setTool = useGameStore((s) => s.setTool);
  const setPlacementDefinition = useGameStore((s) => s.setPlacementDefinition);

  const [submenu, setSubmenu] = useState<'rides' | 'shops' | 'staff' | null>(null);

  const handleClick = useCallback(
    (btn: ToolButton) => {
      if (btn.opensModal === 'finance') {
        onOpenFinance();
        return;
      }
      if (btn.opensModal === 'districts') {
        onOpenDistricts();
        return;
      }
      if (btn.opensSubmenu) {
        if (submenu === btn.opensSubmenu) {
          setSubmenu(null);
        } else {
          setSubmenu(btn.opensSubmenu);
        }
        return;
      }
      if (btn.tool !== null) {
        setTool(btn.tool);
        setPlacementDefinition(null);
        setSubmenu(null);
      }
    },
    [submenu, setTool, setPlacementDefinition, onOpenFinance, onOpenDistricts],
  );

  // Keyboard shortcuts
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      const key = e.key;
      const matched = toolButtons.find((t) => t.shortcut === key);
      if (matched) {
        handleClick(matched);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleClick]);

  function closeSubmenu() {
    setSubmenu(null);
  }

  return (
    <div
      className="fixed bottom-0 left-0 right-0 h-toolbar bg-[#1a1a2e]/90 backdrop-blur-md z-toolbar flex items-center justify-center border-t border-[#2a2a4a]"
      style={{
        boxShadow:
          '0 -1px 0 rgba(8,217,214,0.1), 0 -4px 16px rgba(0,0,0,0.4)',
      }}
    >
      {/* Submenu panels positioned relative to toolbar center */}
      <div className="relative">
        {submenu === 'rides' && <RidePicker onClose={closeSubmenu} />}
        {submenu === 'shops' && <ShopPicker onClose={closeSubmenu} />}
        {submenu === 'staff' && <StaffPicker onClose={closeSubmenu} />}

        {/* Tool buttons row */}
        <div className="flex items-center gap-1.5">
          {toolButtons.map((btn, index) => {
            const isActive =
              btn.tool !== null &&
              selectedTool === btn.tool &&
              !btn.opensSubmenu;
            const isSubmenuActive =
              btn.opensSubmenu !== undefined && submenu === btn.opensSubmenu;

            // Add a subtle divider before Finance/Districts modal buttons
            const showDivider =
              index > 0 && btn.opensModal && !toolButtons[index - 1].opensModal;

            return (
              <div key={btn.label} className="flex items-center gap-1.5">
                {showDivider && (
                  <div className="w-px h-8 bg-[#2a2a4a] mx-0.5" />
                )}
                <button
                  onClick={() => handleClick(btn)}
                  className={`relative w-12 h-12 rounded-lg flex flex-col items-center justify-center transition-all duration-200 group ${
                    isActive || isSubmenuActive
                      ? 'bg-[#08d9d6]/15 text-[#08d9d6] ring-2 ring-[#08d9d6]/60 tool-active-pulse'
                      : 'bg-[#16213e] text-[#94a3b8] hover:bg-[#16213e]/90 hover:text-white hover:shadow-[0_0_12px_rgba(8,217,214,0.2)] hover:border-[#08d9d6]/20'
                  } border border-transparent`}
                  title={`${btn.label}${btn.shortcut ? ` (${btn.shortcut})` : ''}`}
                >
                  <span className="text-lg leading-none transition-transform duration-200 group-hover:scale-110">
                    {btn.icon}
                  </span>
                  <span
                    className={`toolbar-label text-[8px] mt-0.5 leading-none font-medium tracking-wide ${
                      isActive || isSubmenuActive ? 'opacity-100' : 'opacity-60 group-hover:opacity-90'
                    } transition-opacity duration-200`}
                  >
                    {btn.label}
                  </span>

                  {/* Keyboard shortcut badge */}
                  {btn.shortcut && (
                    <span
                      className={`absolute -top-1.5 -right-1.5 w-4 h-4 rounded-md flex items-center justify-center text-[9px] font-mono font-bold transition-all duration-200 ${
                        isActive
                          ? 'bg-[#08d9d6] text-[#0a0a1a] shadow-[0_0_6px_rgba(8,217,214,0.5)]'
                          : 'bg-[#2a2a4a] text-[#94a3b8] border border-[#3a3a5a] group-hover:bg-[#3a3a5a] group-hover:text-white group-hover:border-[#08d9d6]/30'
                      }`}
                    >
                      {btn.shortcut}
                    </span>
                  )}

                  {/* Active indicator dot at bottom */}
                  {(isActive || isSubmenuActive) && (
                    <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-[#08d9d6] shadow-[0_0_6px_rgba(8,217,214,0.6)]" />
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
