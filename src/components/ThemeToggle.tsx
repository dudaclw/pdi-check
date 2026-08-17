import { useState } from 'react'
import { Moon, Sun } from 'lucide-react'
import { Button } from '@/components/ui/button'

/* O tema já foi aplicado pelo script inline do index.html antes da primeira pintura;
   aqui só lemos o que ficou no <html> e alternamos. */
export function ThemeToggle() {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'))

  return (
    <Button
      variant="outline"
      size="icon"
      aria-label={dark ? 'Usar tema claro' : 'Usar tema escuro'}
      onClick={() => {
        const next = !dark
        document.documentElement.classList.toggle('dark', next)
        localStorage.setItem('pdi.theme', next ? 'dark' : 'light')
        setDark(next)
      }}
    >
      {dark ? <Sun /> : <Moon />}
    </Button>
  )
}
