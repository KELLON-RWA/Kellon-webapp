"use client"

import {  useState } from "react"
import { useRouter } from "next/navigation"
import { ExitConfirmation } from "@/components/modals/ExitComfirmationModal"
import BuyCryptoFlow from "./BuyCryptoFlow"

const BuyCryptoFlowManager = () => {
  const router = useRouter()
  const [showExitModal, setShowExitModal] = useState(false)

  const handleAttemptClose = (hasStarted: boolean) => {
    if (hasStarted) {
      setShowExitModal(true) // Trigger your existing confirm modal
    } else {
      router.push("/")
    }
  }

  return (
    <>
      <BuyCryptoFlow onAttemptClose={handleAttemptClose} />

      <ExitConfirmation
        isOpen={showExitModal}
        onStay={() => setShowExitModal(false)}
        onLeave={() => router.push("/")}
        title="Cancel this purchase?"
        description="Your purchase details have not been submitted and will be discarded."
        leaveLabel="Cancel purchase"
      />
    </>
  )
}

export default BuyCryptoFlowManager
