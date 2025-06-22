import React from 'react';
import { Moon, Sun, Monitor, Palette, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTheme } from '@/hooks/use-theme';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

export function ThemeToggle() {
  const { theme, colorTheme, setTheme, setColorTheme, confirmThemeChange } = useTheme();

  const handleThemeChange = async (newTheme: 'light' | 'dark' | 'win95' | 'modern') => {
    if (newTheme !== theme) {
      const confirmed = await confirmThemeChange(newTheme, 'theme');
      if (confirmed) {
        await setTheme(newTheme);
        
        // Show toast notification about theme change
        if (newTheme === 'modern') {
          // This will be handled by the theme change confirmation dialog
        } else {
          // No additional notification needed
        }
      }
    }
  };

  const handleColorThemeChange = async (newColorTheme: 'green' | 'blue' | 'red' | 'orange' | 'purple') => {
    if (newColorTheme !== colorTheme) {
      const confirmed = await confirmThemeChange(newColorTheme, 'color');
      if (confirmed) {
        await setColorTheme(newColorTheme);
      }
    }
  };

  return (
    <div className="flex items-center gap-2">
      {/* Theme Mode Buttons */}
      <div className="flex items-center gap-1 p-1 bg-muted rounded-lg">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => handleThemeChange('light')}
          className={`h-8 w-8 ${theme === 'light' ? 'bg-background shadow-sm' : ''} hover:bg-background/50`}
        >
          <Sun className="h-4 w-4" />
          <span className="sr-only">Light Mode</span>
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => handleThemeChange('dark')}
          className={`h-8 w-8 ${theme === 'dark' ? 'bg-background shadow-sm' : ''} hover:bg-background/50`}
        >
          <Moon className="h-4 w-4" />
          <span className="sr-only">Dark Mode</span>
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => handleThemeChange('win95')}
          className={`h-8 w-8 ${theme === 'win95' ? 'bg-background shadow-sm' : ''} hover:bg-background/50`}
        >
          <Monitor className="h-4 w-4" />
          <span className="sr-only">Windows 95 Mode</span>
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => handleThemeChange('modern')}
          className={`h-8 w-8 ${theme === 'modern' ? 'bg-background shadow-sm border-2 border-blue-500' : ''} hover:bg-background/50 relative`}
        >
          <Sparkles className="h-4 w-4" />
          {theme !== 'modern' && (
            <div className="absolute -top-1 -right-1 w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
          )}
          <span className="sr-only">Modern Mode</span>
        </Button>
      </div>

      {/* Color Theme Dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 hover:bg-accent"
          >
            <Palette className="h-4 w-4" />
            <span className="sr-only">Color Theme</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-40">
          <DropdownMenuItem 
            onClick={() => handleColorThemeChange('green')}
            className={`font-pixelated text-xs ${colorTheme === 'green' ? 'bg-social-green text-white' : ''}`}
          >
            <div className="w-3 h-3 rounded-full bg-social-green mr-2"></div>
            Green Theme
          </DropdownMenuItem>
          <DropdownMenuItem 
            onClick={() => handleColorThemeChange('blue')}
            className={`font-pixelated text-xs ${colorTheme === 'blue' ? 'bg-social-blue text-white' : ''}`}
          >
            <div className="w-3 h-3 rounded-full bg-blue-500 mr-2"></div>
            Blue Theme
          </DropdownMenuItem>
          <DropdownMenuItem 
            onClick={() => handleColorThemeChange('red')}
            className={`font-pixelated text-xs ${colorTheme === 'red' ? 'bg-destructive text-white' : ''}`}
          >
            <div className="w-3 h-3 rounded-full bg-red-500 mr-2"></div>
            Red Theme
          </DropdownMenuItem>
          <DropdownMenuItem 
            onClick={() => handleColorThemeChange('orange')}
            className={`font-pixelated text-xs ${colorTheme === 'orange' ? 'bg-orange-500 text-white' : ''}`}
          >
            <div className="w-3 h-3 rounded-full bg-orange-500 mr-2"></div>
            Orange Theme
          </DropdownMenuItem>
          <DropdownMenuItem 
            onClick={() => handleColorThemeChange('purple')}
            className={`font-pixelated text-xs ${colorTheme === 'purple' ? 'bg-purple-500 text-white' : ''}`}
          >
            <div className="w-3 h-3 rounded-full bg-purple-500 mr-2"></div>
            Purple Theme
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}