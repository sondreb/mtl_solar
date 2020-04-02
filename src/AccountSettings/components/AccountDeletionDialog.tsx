import React from "react"
import { useTranslation } from "react-i18next"
import { Operation, Transaction, Server } from "stellar-sdk"
import DialogContent from "@material-ui/core/DialogContent"
import DialogContentText from "@material-ui/core/DialogContentText"
import Switch from "@material-ui/core/Switch"
import Typography from "@material-ui/core/Typography"
import DeleteIcon from "@material-ui/icons/Delete"
import WarnIcon from "@material-ui/icons/Warning"
import { Account, AccountsContext } from "~App/contexts/accounts"
import { createTransaction } from "~Generic/lib/transaction"
import { useLiveAccountData } from "~Generic/hooks/stellar-subscriptions"
import { useIsMobile, useIsSmallMobile } from "~Generic/hooks/userinterface"
import AccountSelectionList from "~Account/components/AccountSelectionList"
import DialogBody from "~Layout/components/DialogBody"
import MergeIcon from "~Icons/components/Merge"
import { HorizontalLayout } from "~Layout/components/Box"
import ScrollableBalances from "~Generic/components/ScrollableBalances"
import MainTitle from "~Generic/components/MainTitle"
import TransactionSender from "~Transaction/components/TransactionSender"
import { ActionButton, ConfirmDialog, DialogActionsBox } from "~Generic/components/DialogActions"

interface DeletionConfirmationDialogProps {
  merging: boolean
  onCancel: () => void
  onClose: () => void
  onConfirm: () => void
  open: boolean
}

const DeletionConfirmationDialog = React.memo(function DeletionConfirmationDialog(
  props: DeletionConfirmationDialogProps
) {
  const { t } = useTranslation()
  return (
    <ConfirmDialog
      cancelButton={
        <ActionButton onClick={props.onCancel}>{t("account-settings.account-deletion.action.cancel")}</ActionButton>
      }
      confirmButton={
        <ActionButton onClick={props.onConfirm} type="primary">
          {t("account-settings.account-deletion.action.confirm")}
        </ActionButton>
      }
      open={props.open}
      onClose={props.onClose}
      title={t("account-settings.account-deletion.confirm.title")}
    >
      {t("account-settings.account-deletion.confirm.text.delete")}
      {props.merging ? ` ${t("account-settings.account-deletion.confirm.text.merge")}. ` : ". "}
      {t("account-settings.account-deletion.confirm.text.confirm")}
    </ConfirmDialog>
  )
})

interface WarningDialogProps {
  onClose: () => void
  open: boolean
  title: string
  warning: React.ReactNode
}

const WarningDialog = React.memo(function WarningDialog(props: WarningDialogProps) {
  const { t } = useTranslation()
  return (
    <ConfirmDialog
      cancelButton={null}
      confirmButton={
        <ActionButton onClick={props.onClose} type="primary">
          {t("account-settings.account-deletion.warning-dialog.close.label")}
        </ActionButton>
      }
      onClose={props.onClose}
      open={props.open}
      title={props.title}
    >
      {props.warning}
    </ConfirmDialog>
  )
})

interface Warning {
  open: boolean
  text: string
  title: string
}

interface AccountDeletionDialogProps {
  account: Account
  horizon: Server
  onClose: () => void
  onDeleted: () => void
  sendTransaction: (transaction: Transaction) => void
}

function AccountDeletionDialog(props: AccountDeletionDialogProps) {
  const accountData = useLiveAccountData(props.account.publicKey, props.account.testnet)
  const horizon = props.horizon

  const { accounts, deleteAccount } = React.useContext(AccountsContext)
  const [mergeAccountEnabled, setMergeAccountEnabled] = React.useState(false)
  const [confirmationPending, setConfirmationPending] = React.useState(false)
  const [selectedMergeAccount, setSelectedMergeAccount] = React.useState<Account | null>(null)
  const [warning, setWarning] = React.useState<Warning | undefined>()

  const { t } = useTranslation()
  const isSmallScreen = useIsMobile()
  const isTinyScreen = useIsSmallMobile()

  const cancelConfirmation = React.useCallback(() => setConfirmationPending(false), [setConfirmationPending])
  const toggleMergeAccount = React.useCallback(() => setMergeAccountEnabled(enabled => !enabled), [])

  const closeWarning = React.useCallback(() => {
    setWarning(prev => (prev ? { ...prev, open: false } : undefined))
  }, [setWarning])

  const onDelete = () => {
    deleteAccount(props.account.id)
    props.onClose()
    props.onDeleted()
  }

  const onMerge = async () => {
    if (selectedMergeAccount) {
      const transaction = await createTransaction(
        [
          Operation.accountMerge({
            source: props.account.publicKey,
            destination: selectedMergeAccount.publicKey
          })
        ],
        { accountData, horizon, walletAccount: props.account }
      )

      await props.sendTransaction(transaction)
      setTimeout(onDelete, 1000)
    }
  }

  const onConfirm = () => {
    setConfirmationPending(false)
    if (mergeAccountEnabled) {
      onMerge()
    } else {
      onDelete()
    }
  }

  const requestConfirmation = React.useCallback(() => {
    if (accountData.subentry_count > 0) {
      setWarning({
        open: true,
        text: t("account-settings.account-deletion.warnings.cannot-merge.text"),
        title: t("account-settings.account-deletion.warnings.cannot-merge.title")
      })
    } else {
      setConfirmationPending(true)
    }
  }, [accountData, setConfirmationPending, setWarning, t])

  const remainingFundsContent = React.useMemo(
    () =>
      accountData.balances.length > 0 ? (
        <>
          <HorizontalLayout alignItems="center" style={{ marginTop: 24, marginLeft: -12, marginBottom: 8 }}>
            <Switch color="primary" checked={mergeAccountEnabled} onChange={toggleMergeAccount} />
            <Typography
              onClick={toggleMergeAccount}
              variant="h6"
              style={{
                display: "flex",
                alignItems: "center",
                height: 48,
                cursor: "pointer",
                fontSize: isSmallScreen ? 16 : 20,
                marginLeft: 8
              }}
            >
              {t("account-settings.account-deletion.remaining-funds.text")}
            </Typography>
          </HorizontalLayout>

          <AccountSelectionList
            disabled={!mergeAccountEnabled}
            accounts={accounts.filter(
              account => account.publicKey !== props.account.publicKey && account.testnet === props.account.testnet
            )}
            testnet={props.account.testnet}
            onChange={setSelectedMergeAccount}
          />
        </>
      ) : null,
    [
      accountData.balances.length,
      mergeAccountEnabled,
      toggleMergeAccount,
      isSmallScreen,
      t,
      accounts,
      props.account.testnet,
      props.account.publicKey
    ]
  )

  return (
    <DialogBody
      background={<WarnIcon style={{ fontSize: 160 }} />}
      top={
        <>
          <MainTitle
            title={<span>{t("account-settings.account-deletion.title")}</span>}
            titleColor="inherit"
            onBack={props.onClose}
            style={{ marginTop: 0, marginLeft: 0 }}
          />
          <ScrollableBalances account={props.account} compact />
        </>
      }
      actions={
        <DialogActionsBox>
          {mergeAccountEnabled ? (
            <ActionButton
              autoFocus
              disabled={!selectedMergeAccount}
              icon={<MergeIcon />}
              onClick={requestConfirmation}
              type="primary"
            >
              {isTinyScreen
                ? t("account-settings.account-deletion.action.merge.short")
                : t("account-settings.account-deletion.action.merge.long")}
            </ActionButton>
          ) : (
            <ActionButton autoFocus icon={<DeleteIcon />} onClick={requestConfirmation} type="primary">
              {t("account-settings.account-deletion.action.delete")}
            </ActionButton>
          )}
        </DialogActionsBox>
      }
    >
      <DialogContent style={{ padding: 0 }}>
        <DialogContentText style={{ marginTop: 24 }}>
          {t("account-settings.account-deletion.text.1", { accountName: props.account.name })}
        </DialogContentText>
        <DialogContentText style={{ display: accountData.balances.length > 0 ? undefined : "none", marginTop: 16 }}>
          {t("account-settings.account-deletion.text.2")}
        </DialogContentText>

        {remainingFundsContent}

        <DeletionConfirmationDialog
          merging={mergeAccountEnabled}
          onCancel={cancelConfirmation}
          onClose={cancelConfirmation}
          onConfirm={onConfirm}
          open={confirmationPending}
        />
        <WarningDialog
          onClose={closeWarning}
          open={Boolean(warning?.open)}
          title={warning?.title || ""}
          warning={warning?.text}
        />
      </DialogContent>
    </DialogBody>
  )
}

interface AccountDeletionContainerProps {
  account: Account
  onClose: () => void
  onDeleted: () => void
}

function AccountDeletionContainer(props: AccountDeletionContainerProps) {
  return (
    <TransactionSender account={props.account}>
      {txContext => <AccountDeletionDialog {...props} {...txContext} />}
    </TransactionSender>
  )
}

export default AccountDeletionContainer