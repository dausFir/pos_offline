/**
 * Icon — offline-safe icon component
 * Maps Material Symbols names → Lucide React SVGs
 * 100% bundled, no CDN needed
 */
import {
  LayoutDashboard, ShoppingCart, Package, Receipt, Users, Settings, LogOut,
  Search, Plus, Minus, Trash2, Edit2, X, Check, ChevronDown, ChevronRight,
  RefreshCw, Download, Upload, Save, Eye, EyeOff, Lock, Unlock, User, UserPlus,
  Tag, Percent, Star, Bell, BellOff, HelpCircle, Info, AlertTriangle, AlertCircle,
  CheckCircle, XCircle, Clock, Calendar, Filter, SlidersHorizontal,
  TrendingUp, TrendingDown, BarChart2, PieChart, Activity,
  ArrowUp, ArrowDown, ArrowLeft, ArrowRight, ArrowUpDown,
  Truck, Store, Building2, MapPin, Phone, Mail, Globe, Wifi, WifiOff,
  CreditCard, Banknote, QrCode, Wallet, DollarSign,
  FileText, FileSpreadsheet, FilePlus, FileDown, FileUp, FolderOpen,
  Camera, ScanLine, Barcode, Printer, Monitor, Smartphone,
  ShoppingBag, Package2, Boxes, Archive, Layers,
  Pause, Play, PlayCircle, StopCircle, SkipForward,
  History, ClipboardList, ClipboardCheck, Clipboard,
  Key, Shield, ShieldCheck, Fingerprint,
  Home, Menu, MoreVertical, MoreHorizontal,
  Sun, Moon, Maximize, Minimize, ExternalLink, Link, Copy,
  RotateCcw, RotateCw, Repeat, Shuffle,
  ChevronUp, ChevronsUpDown, ListFilter, LayoutGrid, List,
  Zap, Flame, Sparkles, Heart, ThumbsUp,
  LogIn, LogOut as SignOut, Power, Keyboard,
  Group, UserCheck, UserX, Users2,
  PersonStanding, Contact, BookUser,
  Handshake, BadgeCheck, Award, Trophy,
  ReceiptText, Calculator, Coins, PiggyBank, BanknoteIcon,
  SplitSquareHorizontal, Merge, GitMerge,
  TriangleAlert, CircleAlert, CircleX, CircleCheck, CircleDot,
  Loader2, Loader,
} from 'lucide-react';

// Map Material Symbol names → Lucide components
const MAP = {
  // Navigation / layout
  'dashboard':           LayoutDashboard,
  'home':                Home,
  'menu':                Menu,
  'close':               X,
  'chevron_right':       ChevronRight,
  'chevron_down':        ChevronDown,
  'expand_more':         ChevronDown,
  'more_vert':           MoreVertical,
  'more_horiz':          MoreHorizontal,
  'open_in_new':         ExternalLink,
  'keyboard':            Keyboard,
  'shield':              ShieldCheck,

  // Store / commerce
  'storefront':          Store,
  'point_of_sale':       ShoppingCart,
  'shopping_cart':       ShoppingCart,
  'shopping_bag':        ShoppingBag,
  'add_shopping_cart':   ShoppingCart,
  'inventory_2':         Package,
  'inventory':           Package,
  'package':             Package2,
  'boxes':               Boxes,
  'category':            Layers,
  'layers':              Layers,
  'sell':                Tag,
  'local_offer':         Tag,
  'payments':            Banknote,
  'payment':             CreditCard,
  'qr_code':             QrCode,
  'qr_code_scanner':     ScanLine,
  'credit_card':         CreditCard,
  'wallet':              Wallet,
  'savings':             PiggyBank,
  'coins':               Coins,
  'call_split':          SplitSquareHorizontal,

  // Documents / files
  'receipt_long':        ReceiptText,
  'receipt':             Receipt,
  'description':         FileText,
  'article':             FileText,
  'analytics':           BarChart2,
  'assessment':          BarChart2,
  'bar_chart':           BarChart2,
  'pie_chart':           PieChart,
  'trending_up':         TrendingUp,
  'trending_down':       TrendingDown,
  'show_chart':          Activity,
  'upload_file':         FileUp,
  'download':            Download,
  'upload':              Upload,
  'file_download':       FileDown,
  'file_upload':         FileUp,
  'folder_open':         FolderOpen,
  'clipboard':           Clipboard,
  'content_paste':       ClipboardList,
  'task':                ClipboardCheck,
  'history_edu':         ClipboardList,

  // People / users
  'person':              User,
  'person_add':          UserPlus,
  'person_search':       Search,
  'group':               Users,
  'people':              Users2,
  'manage_accounts':     Settings,
  'account_circle':      User,
  'badge':               BadgeCheck,
  'contact_page':        Contact,
  'contacts':            BookUser,

  // Actions
  'add':                 Plus,
  'add_circle':          Plus,
  'add_business':        Building2,
  'remove':              Minus,
  'delete':              Trash2,
  'delete_sweep':        Trash2,
  'edit':                Edit2,
  'save':                Save,
  'search':              Search,
  'search_off':          Search,
  'filter_alt':          Filter,
  'filter_list':         ListFilter,
  'tune':                SlidersHorizontal,
  'refresh':             RefreshCw,
  'sync':                RefreshCw,
  'print':               Printer,
  'copy_all':            Copy,
  'content_copy':        Copy,
  'lock':                Lock,
  'lock_reset':          RotateCcw,
  'visibility':          Eye,
  'visibility_off':      EyeOff,
  'login':               LogIn,
  'logout':              SignOut,
  'power_settings_new':  Power,
  'check':               Check,
  'check_circle':        CheckCircle,
  'done':                Check,
  'done_all':            CheckCircle,
  'cancel':              XCircle,
  'block':               XCircle,
  'undo':                RotateCcw,
  'redo':                RotateCw,
  'replay':              RotateCcw,

  // Status / feedback
  'info':                Info,
  'info_outline':        Info,
  'warning':             AlertTriangle,
  'error':               AlertCircle,
  'error_outline':       AlertCircle,
  'help_outline':        HelpCircle,
  'help':                HelpCircle,
  'notifications':       Bell,
  'notifications_off':   BellOff,
  'star':                Star,
  'favorite':            Heart,
  'thumb_up':            ThumbsUp,
  'tips_and_updates':    Sparkles,
  'new_releases':        Zap,
  'emoji_events':        Trophy,
  'military_tech':       Award,
  'pending':             Clock,
  'do_not_disturb_on':   XCircle,
  'circle_dot':          CircleDot,
  'loader':              Loader2,

  // Time / date
  'calendar_today':      Calendar,
  'date_range':          Calendar,
  'schedule':            Clock,
  'history':             History,
  'manage_history':      History,
  'update':              RefreshCw,

  // Transport / location
  'local_shipping':      Truck,
  'delivery_dining':     Truck,
  'location_on':         MapPin,
  'map':                 MapPin,
  'phone':               Phone,
  'call':                Phone,
  'email':               Mail,
  'language':            Globe,
  'wifi':                Wifi,
  'wifi_off':            WifiOff,
  'monitor':             Monitor,
  'smartphone':          Smartphone,
  'qr_code_2':           QrCode,
  'camera':              Camera,
  'camera_alt':          Camera,
  'photo_camera':        Camera,
  'barcode':             Barcode,

  // Swap / arrows
  'swap_horiz':          ArrowUpDown,
  'swap_vert':           ArrowUpDown,
  'arrow_upward':        ArrowUp,
  'arrow_downward':      ArrowDown,
  'arrow_back':          ArrowLeft,
  'arrow_forward':       ArrowRight,
  'north':               ArrowUp,
  'south':               ArrowDown,

  // Media / playback
  'pause':               Pause,
  'pause_circle':        Pause,
  'play_arrow':          Play,
  'play_circle':         PlayCircle,
  'stop':                StopCircle,
  'skip_next':           SkipForward,

  // Layout
  'grid_view':           LayoutGrid,
  'list':                List,
  'view_list':           List,
  'table_rows':          List,
  'view_module':         LayoutGrid,

  // Security
  'security':            Shield,
  'verified_user':       ShieldCheck,
  'key':                 Key,
  'password':            Key,
  'fingerprint':         Fingerprint,

  // Misc
  'dark_mode':           Moon,
  'light_mode':          Sun,
  'fullscreen':          Maximize,
  'fullscreen_exit':     Minimize,
  'link':                Link,
  'handshake':           Handshake,
  'repeat':              Repeat,
  'shuffle':             Shuffle,
  'merge':               GitMerge,
};

export default function Icon({ name, size = 18, color, className = '', style = {}, filled = false }) {
  const Component = MAP[name] || AlertCircle; // fallback to alert if unknown

  return (
    <Component
      size={size}
      color={color}
      className={className}
      style={style}
      strokeWidth={filled ? 2.5 : 1.75}
    />
  );
}
