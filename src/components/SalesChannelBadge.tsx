import { CreditCard, DollarSign } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

// Import channel logos
const amazonLogo = '/images/sales-channels/Amazon.png';
const ebayLogo = '/images/sales-channels/Ebay.png';
const etsyLogo = '/images/sales-channels/Etsy.png';
const tiktokLogo = '/images/sales-channels/TikTok.png';
const zelleLogo = '/images/sales-channels/Zelle.png';
const whatsappLogo = '/images/sales-channels/Whatsapp.png';
const cosmeticMpLogo = '/images/sales-channels/Vertex_Rental_Cars.png';

interface SalesChannelBadgeProps {
  canal: string;
  className?: string;
}

export function SalesChannelBadge({
  canal,
  className
}: SalesChannelBadgeProps) {
  if (canal === 'Newsletter') {
    return <Badge variant="default" className="rounded-none ml-[25px] border-0 border-none shadow-none bg-black hover:bg-black">
        <span className="flex items-center justify-center gap-1 px-2 text-center">
          <span className="text-xs text-white">Newsletter</span>
        </span>
      </Badge>;
  }

  const getChannelDisplay = () => {
    switch (canal) {
      case 'Amazon':
        return {
          icon: <img alt="Amazon" className="w-[70px] h-[36px] object-contain" src="https://upload.wikimedia.org/wikipedia/commons/thumb/a/a9/Amazon_logo.svg/1280px-Amazon_logo.svg.png" />,
          text: null,
          variant: 'secondary' as const
        };
      case 'eBay':
        return {
          icon: <img src={ebayLogo} alt="eBay" className="w-[70px] h-[36px] rounded-none object-contain" />,
          text: null,
          variant: 'secondary' as const
        };
      case 'Etsy':
        return {
          icon: <img src={etsyLogo} alt="Etsy" className="w-[70px] h-[36px] object-contain" />,
          text: null,
          variant: 'secondary' as const
        };
      case 'TikTok':
        return {
          icon: <img src={tiktokLogo} alt="TikTok" className="w-[70px] h-[36px] object-contain" />,
          text: null,
          variant: 'secondary' as const
        };
      case 'Vertex Rental Cars':
        return {
          icon: <img src={cosmeticMpLogo} alt="Vertex Rental Cars" className="w-[70px] h-[36px] object-contain" />,
          text: null,
          variant: 'default' as const
        };
      case 'Credit Card':
      case 'Credit Card / Presencial':
        return {
          icon: <CreditCard className="text-primary w-[28px] h-[28px]" />,
          text: null,
          variant: 'default' as const
        };
      case 'Money / Presencial':
        return {
          icon: <DollarSign className="text-primary w-[28px] h-[28px]" />,
          text: null,
          variant: 'default' as const
        };
      case 'Zelle':
        return {
          icon: <img src={zelleLogo} alt="Zelle" className="w-[70px] h-[36px] object-contain" />,
          text: null,
          variant: 'secondary' as const
        };
      case 'WhatsApp':
        return {
          icon: <img src={whatsappLogo} alt="WhatsApp" className="w-[70px] h-[36px] object-contain" />,
          text: null,
          variant: 'default' as const
        };
      case 'Outro':
        return {
          icon: null,
          text: 'Outro',
          variant: 'outline' as const
        };
      default:
        return {
          icon: null,
          text: canal || 'N/A',
          variant: 'outline' as const
        };
    }
  };

  const {
    icon,
    text,
    variant
  } = getChannelDisplay();

  return <Badge variant={variant} className="rounded-none ml-[25px] border-0 border-none shadow-none bg-transparent hover:bg-transparent p-0">
      <span className="flex items-center justify-center gap-1 px-0 text-center h-9 overflow-hidden">
        {icon}
        {text && <span className="text-xs text-secondary-foreground">{text}</span>}
      </span>
    </Badge>;
}