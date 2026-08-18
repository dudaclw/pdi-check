import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { farYears, fmtDate, isFarDeadline } from '@/lib/pdi'

/** Prazo daqui a séculos quase sempre é dedo escorregando no campo de data.
 *  Não bloqueia nem corrige nada — só levanta a sobrancelha e segue o baile. */
export function useFarDeadline() {
  const [date, setDate] = useState('')
  const years = date ? farYears(date) : 0

  return {
    check: (iso: string) => {
      if (isFarDeadline(iso)) setDate(iso)
    },
    dialog: (
      <Dialog open={!!date} onOpenChange={() => setDate('')}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Opa! Vai demorar um pouco…</DialogTitle>
            <DialogDescription>
              {years > 100
                ? `Você marcou ${fmtDate(date)} — daqui a ${years} anos. Seus bisnetos vão receber essa meta de herança, com juros.`
                : `Você marcou ${fmtDate(date)}, daqui a ${years} anos. Se o plano é esse mesmo, respeito. Se escapou um dígito, ainda dá tempo.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setDate('')}>Tá valendo</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    ),
  }
}
