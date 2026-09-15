import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { US_STATES } from '@/lib/us-states';

const CLIENT_TYPES = ['Individual', 'Corporate', 'Insurance Replacement'] as const;
const CHANNEL_OPTIONS = [
  'Website', 'Phone', 'Walk-in', 'Referral', 'Repeat Customer', 'Social Media', 'Insurance Referral', 'Other',
] as const;

const clientSchema = z.object({
  nome_razao: z.string().min(1, "Full name is required"),
  tipo: z.enum(CLIENT_TYPES),
  email: z.union([z.string().email('Invalid email'), z.literal('')]).optional().transform(val => val || null),
  telefone: z.string().optional(),
  date_of_birth: z.string().optional(),
  license_number: z.string().optional(),
  license_state: z.string().optional(),
  license_expiration: z.string().optional(),
  contato_responsavel: z.string().optional(),
  endereco_rua: z.string().optional(),
  endereco_cidade: z.string().optional(),
  endereco_estado: z.string().optional(),
  endereco_cep: z.string().optional(),
  endereco_pais: z.string().optional(),
  canal_principal: z.enum(CHANNEL_OPTIONS).optional(),
  observacoes: z.string().optional(),
});

type ClientFormData = z.infer<typeof clientSchema>;

interface ClientFormProps {
  client?: any;
  onSuccess: () => void;
  onCancel: () => void;
}

export function ClientForm({ client, onSuccess, onCancel }: ClientFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const form = useForm<ClientFormData>({
    resolver: zodResolver(clientSchema),
    defaultValues: {
      nome_razao: client?.nome_razao || '',
      tipo: client?.tipo || 'Individual',
      email: client?.email || '',
      telefone: client?.telefone || '',
      date_of_birth: client?.date_of_birth || '',
      license_number: client?.license_number || '',
      license_state: client?.license_state || '',
      license_expiration: client?.license_expiration || '',
      contato_responsavel: client?.contato_responsavel || '',
      endereco_rua: client?.endereco_rua || '',
      endereco_cidade: client?.endereco_cidade || '',
      endereco_estado: client?.endereco_estado || '',
      endereco_cep: client?.endereco_cep || '',
      endereco_pais: client?.endereco_pais || 'United States',
      canal_principal: client?.canal_principal || undefined,
      observacoes: client?.observacoes || '',
    },
  });

  const onSubmit = async (data: ClientFormData) => {
    setIsLoading(true);
    try {
      const cleanData = {
        ...data,
        email: data.email || null,
        telefone: data.telefone || null,
        date_of_birth: data.date_of_birth || null,
        license_number: data.license_number || null,
        license_state: data.license_state || null,
        license_expiration: data.license_expiration || null,
        contato_responsavel: data.contato_responsavel || null,
        endereco_rua: data.endereco_rua || null,
        endereco_cidade: data.endereco_cidade || null,
        endereco_estado: data.endereco_estado || null,
        endereco_cep: data.endereco_cep || null,
        endereco_pais: data.endereco_pais || 'United States',
        canal_principal: data.canal_principal || null,
        observacoes: data.observacoes || null,
      };

      if (client) {
        const { error } = await supabase
          .from('clients')
          .update(cleanData)
          .eq('id', client.id);

        if (error) throw error;
        toast({ title: 'Client updated successfully!' });
      } else {
        const { error } = await supabase
          .from('clients')
          .insert([cleanData]);

        if (error) throw error;
        toast({ title: 'Client created successfully!' });
      }

      onSuccess();
    } catch (error) {
      console.error('Error saving client:', error);
      toast({
        title: 'Error saving client',
        description: 'Please try again later.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="nome_razao"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Full Name *</FormLabel>
                <FormControl>
                  <Input placeholder="As shown on driver's license" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="tipo"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Client Type *</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {CLIENT_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input type="email" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="telefone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Phone</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Driver on file — collected once, snapshotted onto each booking at trip time */}
        <div className="rounded-lg border p-4 space-y-3">
          <p className="text-sm font-semibold">Driver&apos;s license on file</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <FormField
              control={form.control}
              name="date_of_birth"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Date of Birth</FormLabel>
                  <FormControl>
                    <Input type="date" lang="en-US" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="license_number"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>License Number</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="license_expiration"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>License Expiration</FormLabel>
                  <FormControl>
                    <Input type="date" lang="en-US" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <FormField
            control={form.control}
            name="license_state"
            render={({ field }) => (
              <FormItem className="sm:w-1/3">
                <FormLabel>Issuing State</FormLabel>
                <Select onValueChange={field.onChange} value={field.value || undefined}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select state" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {US_STATES.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="contato_responsavel"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Emergency Contact</FormLabel>
              <FormControl>
                <Input placeholder="Name and phone number" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="endereco_rua"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Street Address</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="endereco_cidade"
            render={({ field }) => (
              <FormItem>
                <FormLabel>City</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <FormField
            control={form.control}
            name="endereco_estado"
            render={({ field }) => (
              <FormItem>
                <FormLabel>State</FormLabel>
                <Select onValueChange={field.onChange} value={field.value || undefined}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select state" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {US_STATES.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="endereco_cep"
            render={({ field }) => (
              <FormItem>
                <FormLabel>ZIP Code</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="endereco_pais"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Country</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="canal_principal"
          render={({ field }) => (
            <FormItem>
              <FormLabel>How They Found Us</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {CHANNEL_OPTIONS.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="observacoes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notes</FormLabel>
              <FormControl>
                <Textarea {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end space-x-2">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" disabled={isLoading}>
            {isLoading ? 'Saving...' : client ? 'Update' : 'Create'}
          </Button>
        </div>
      </form>
    </Form>
  );
}
