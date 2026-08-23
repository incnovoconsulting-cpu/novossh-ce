/**
 * Icon exports — Phosphor icons at "light" weight, drop-in replacement for lucide-react.
 * Import from '@/lib/icons' instead of 'lucide-react'.
 */
import type { ComponentProps } from 'react'
import {
  ArrowClockwise as PhArrowClockwise,
  ArrowCounterClockwise as PhArrowCounterClockwise,
  ArrowDown as PhArrowDown,
  ArrowLeft as PhArrowLeft,
  ArrowRight as PhArrowRight,
  ArrowSquareOut as PhArrowSquareOut,
  ArrowUp as PhArrowUp,
  ArrowsDownUp as PhArrowsDownUp,
  ArrowsLeftRight as PhArrowsLeftRight,
  Bookmark as PhBookmark,
  BookmarkSimple as PhBookmarkSimple,
  BookOpen as PhBookOpen,
  CalendarBlank as PhCalendarBlank,
  CaretDown as PhCaretDown,
  CaretRight as PhCaretRight,
  CaretUp as PhCaretUp,
  ChartBar as PhChartBar,
  ChatText as PhChatText,
  Check as PhCheck,
  CheckCircle as PhCheckCircle,
  CircleNotch as PhCircleNotch,
  Clock as PhClock,
  ClockCounterClockwise as PhClockCounterClockwise,
  Code as PhCode,
  Command as PhCommand,
  ComputerTower as PhComputerTower,
  Copy as PhCopy,
  CreditCard as PhCreditCard,
  Database as PhDatabase,
  DeviceMobile as PhDeviceMobile,
  DotsThreeVertical as PhDotsThreeVertical,
  DownloadSimple as PhDownloadSimple,
  EnvelopeSimple as PhEnvelopeSimple,
  Eye as PhEye,
  EyeSlash as PhEyeSlash,
  File as PhFile,
  FileArchive as PhFileArchive,
  FileCode as PhFileCode,
  FileImage as PhFileImage,
  FileLock as PhFileLock,
  FileText as PhFileText,
  FileZip as PhFileZip,
  Flask as PhFlask,
  FloppyDisk as PhFloppyDisk,
  Folder as PhFolder,
  FolderOpen as PhFolderOpen,
  FolderPlus as PhFolderPlus,
  GearSix as PhGearSix,
  GithubLogo as PhGithubLogo,
  Globe as PhGlobe,
  HardDrive as PhHardDrive,
  House as PhHouse,
  Info as PhInfo,
  Key as PhKey,
  Lightning as PhLightning,
  List as PhList,
  Lock as PhLock,
  MagnifyingGlass as PhMagnifyingGlass,
  Monitor as PhMonitor,
  Network as PhNetwork,
  NotePencil as PhNotePencil,
  Package as PhPackage,
  Palette as PhPalette,
  PaperPlaneTilt as PhPaperPlaneTilt,
  Pause as PhPause,
  Pencil as PhPencil,
  Play as PhPlay,
  Plus as PhPlus,
  Pulse as PhPulse,
  Shield as PhShield,
  ShieldCheck as PhShieldCheck,
  ShieldSlash as PhShieldSlash,
  SidebarSimple as PhSidebarSimple,
  SignOut as PhSignOut,
  Stack as PhStack,
  Terminal as PhTerminal,
  TerminalWindow as PhTerminalWindow,
  Trash as PhTrash,
  TwitterLogo as PhTwitterLogo,
  UploadSimple as PhUploadSimple,
  Usb as PhUsb,
  Warning as PhWarning,
  WarningCircle as PhWarningCircle,
  WifiHigh as PhWifiHigh,
  WifiSlash as PhWifiSlash,
  X as PhX,
  XCircle as PhXCircle,
} from '@phosphor-icons/react'

type PhIcon = React.ComponentType<ComponentProps<typeof PhX>>

function w(Icon: PhIcon) {
  const Wrapped = (props: ComponentProps<typeof PhX>) => <Icon weight="light" {...props} />
  Wrapped.displayName = (Icon as { displayName?: string }).displayName
  return Wrapped
}

// Named exports matching lucide-react API
export const Activity = w(PhPulse)
export const AlertCircle = w(PhWarningCircle)
export const AlertTriangle = w(PhWarning)
export const ArrowDown = w(PhArrowDown)
export const ArrowLeft = w(PhArrowLeft)
export const ArrowUp = w(PhArrowUp)
export const ArrowUpDown = w(PhArrowsDownUp)
export const BarChart3 = w(PhChartBar)
export const Bookmark = w(PhBookmark)
export const BookmarkCheck = w(PhBookmarkSimple)
export const BookOpen = w(PhBookOpen)
export const Calendar = w(PhCalendarBlank)
export const Check = w(PhCheck)
export const CheckCircle = w(PhCheckCircle)
export const CheckCircle2 = w(PhCheckCircle)
export const ChevronDown = w(PhCaretDown)
export const ChevronRight = w(PhCaretRight)
export const Clock = w(PhClock)
export const Code2 = w(PhCode)
export const Command = w(PhCommand)
export const Copy = w(PhCopy)
export const CreditCard = w(PhCreditCard)
export const Database = w(PhDatabase)
export const Download = w(PhDownloadSimple)
export const Edit3 = w(PhNotePencil)
export const ExternalLink = w(PhArrowSquareOut)
export const FileText = w(PhFileText)
export const FolderOpen = w(PhFolderOpen)
export const FolderPlus = w(PhFolderPlus)
export const Github = w(PhGithubLogo)
export const Globe = w(PhGlobe)
export const GearSix = w(PhGearSix)
export const History = w(PhClockCounterClockwise)
export const Home = w(PhHouse)
export const Info = w(PhInfo)
export const Key = w(PhKey)
export const KeyRound = w(PhKey)
export const Loader = w(PhCircleNotch)
export const Lock = w(PhLock)
export const LogOut = w(PhSignOut)
export const Mail = w(PhEnvelopeSimple)
export const MessageSquare = w(PhChatText)
export const Monitor = w(PhMonitor)
export const MoreVertical = w(PhDotsThreeVertical)
export const Network = w(PhNetwork)
export const Palette = w(PhPalette)
export const PanelLeftClose = w(PhSidebarSimple)
export const PanelLeftOpen = w(PhSidebarSimple)
export const Pause = w(PhPause)
export const Pencil = w(PhPencil)
export const Play = w(PhPlay)
export const PlayCircle = w(PhPlay)
export const Plus = w(PhPlus)
export const RefreshCw = w(PhArrowClockwise)
export const RotateCcw = w(PhArrowCounterClockwise)
export const Save = w(PhFloppyDisk)
export const Search = w(PhMagnifyingGlass)
export const Send = w(PhPaperPlaneTilt)
export const Server = w(PhComputerTower)
export const ServerCog = w(PhGearSix)
export const Settings = w(PhGearSix)
export const Shield = w(PhShield)
export const ShieldCheck = w(PhShieldCheck)
export const ShieldOff = w(PhShieldSlash)
export const Smartphone = w(PhDeviceMobile)
export const Terminal = w(PhTerminal)
export const TerminalSquare = w(PhTerminalWindow)
export const TestTube = w(PhFlask)
export const Trash2 = w(PhTrash)
export const Upload = w(PhUploadSimple)
export const Usb = w(PhUsb)
export const Wifi = w(PhWifiHigh)
export const WifiOff = w(PhWifiSlash)
export const X = w(PhX)
export const XCircle = w(PhXCircle)
export const Zap = w(PhLightning)
export const ArrowRight = w(PhArrowRight)
export const ArrowRightLeft = w(PhArrowsLeftRight)
export const Boxes = w(PhPackage)
export const ChevronUp = w(PhCaretUp)
export const Eye = w(PhEye)
export const EyeOff = w(PhEyeSlash)
export const File = w(PhFile)
export const FileArchive = w(PhFileZip)
export const FileCode = w(PhFileCode)
export const FileImage = w(PhFileImage)
export const FileJson = w(PhFileText)
export const FileKey = w(PhFileLock)
export const Folder = w(PhFolder)
export const Layers = w(PhStack)
export const Menu = w(PhList)
export const Twitter = w(PhTwitterLogo)
