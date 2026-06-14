<?php

namespace Database\Seeders;

use App\Models\Ecommerce\EcommerceLandingPage;
use App\Models\Permission;
use App\Models\PermissionGroup;
use App\Models\Role;
use App\Models\User;
use Illuminate\Database\Seeder;

/**
 * Safe launch on live/staging (run after migrate):
 *
 *   php artisan db:seed --class=EcommerceLandingPageLaunchSeeder
 *
 * - Ensures ecommerce.landing-page permissions exist
 * - Grants permissions to super admin role
 * - Seeds default Visit Our Studio ONLY when no ecommerce landing page row exists yet
 */
class EcommerceLandingPageLaunchSeeder extends Seeder
{
    public function run(): void
    {
        $this->ensurePermissions();
        $this->seedLandingPageIfMissing();
        $this->patchMissingSections();

        $this->command?->info('Ecommerce landing page launch seeder completed.');
    }

    private function ensurePermissions(): void
    {
        $group = PermissionGroup::firstOrCreate(
            ['name' => 'Ecommerce Landing Page'],
            ['sort_order' => 999]
        );

        $slugs = ['ecommerce.landing-page.view', 'ecommerce.landing-page.update'];
        $permissionIds = [];

        foreach ($slugs as $slug) {
            $permission = Permission::firstOrCreate(
                ['slug' => $slug],
                [
                    'name' => str_replace('.', ' ', ucwords(str_replace('.', ' ', $slug))),
                    'description' => null,
                    'group_id' => $group->id,
                ]
            );
            $permissionIds[] = $permission->id;
        }

        $superAdminRole = Role::where('name', 'infra_core_x1')->first();
        if ($superAdminRole) {
            $superAdminRole->permissions()->syncWithoutDetaching($permissionIds);
        }

        $superAdminUser = User::where('email', 'infrax1@example.com')->first();
        if ($superAdminUser && $superAdminRole) {
            $superAdminUser->roles()->syncWithoutDetaching([$superAdminRole->id]);
        }
    }

    private function seedLandingPageIfMissing(): void
    {
        if (EcommerceLandingPage::where('slug', 'home')->exists()) {
            $this->command?->info('Ecommerce landing page (slug=home) already exists. Skipping seed data.');

            return;
        }

        EcommerceLandingPage::create([
            'slug' => 'home',
            'sections' => $this->defaultSections(),
            'is_active' => true,
        ]);

        $this->command?->info('Created default ecommerce landing page (slug=home).');
    }

    /** Add hero / slider_intro to existing rows without touching visit_studio content. */
    private function patchMissingSections(): void
    {
        $page = EcommerceLandingPage::where('slug', 'home')->first();
        if (! $page) {
            return;
        }

        $sections = is_array($page->sections) ? $page->sections : [];
        $changed = false;

        if (! isset($sections['slider_intro']) || ! is_array($sections['slider_intro'])) {
            $sections['slider_intro'] = [
                'is_active' => true,
                'headline' => 'Effortless silhouettes, luxe textures, everyday confidence.',
            ];
            $changed = true;
        }

        if (! isset($sections['hero']) || ! is_array($sections['hero'])) {
            $sections['hero'] = [
                'is_active' => true,
                'label' => '',
                'title' => '',
                'subtitle' => '',
                'title_2' => '',
                'subtitle_2' => '',
                'cta_label' => 'Shop Now',
                'cta_link' => '/shop',
            ];
            $changed = true;
        }

        if (! $changed) {
            $this->command?->info('Ecommerce landing page sections already include hero and slider headline.');

            return;
        }

        $page->sections = $sections;
        $page->save();

        $this->command?->info('Patched ecommerce landing page with hero and slider headline sections.');
    }

    private function defaultSections(): array
    {
        return [
            'slider_intro' => [
                'is_active' => true,
                'headline' => 'Effortless silhouettes, luxe textures, everyday confidence.',
            ],
            'hero' => [
                'is_active' => true,
                'label' => '',
                'title' => '',
                'subtitle' => '',
                'title_2' => '',
                'subtitle_2' => '',
                'cta_label' => 'Shop Now',
                'cta_link' => '/shop',
            ],
            'visit_studio' => [
                    'is_active' => true,
                    'heading' => [
                        'label' => '',
                        'title' => 'Visit Our Studio',
                        'align' => 'left',
                    ],
                    'studio_name' => 'NAILSBYLITTLEBOO SALON',
                    'address' => "123 Example Street\nKuala Lumpur\nMalaysia",
                    'google_maps_url' => 'https://maps.google.com/',
                    'waze_url' => 'https://www.waze.com/',
                    'whatsapp_phone' => '60123456789',
                    'whatsapp_message' => 'Hi! I would like to get in touch about your shop.',
                    'google_maps_label' => 'GOOGLE MAPS',
                    'waze_label' => 'OPEN WAZE',
                    'whatsapp_label' => 'MESSAGE US ON WHATSAPP',
                    'opening_hours_heading' => 'Opening Hours',
                    'opening_hours' => [
                        [
                            'day_range' => 'Monday — Friday',
                            'time_range' => '11:00 AM — 6:30 PM',
                        ],
                        [
                            'day_range' => 'Saturday — Sunday',
                            'time_range' => '9:00 AM — 4:30 PM',
                        ],
                    ],
                    'bottom_label' => "OPERATED BY DAUN SEGAR SDN BHD (1234567-A)\n© 2026 NAILSBYLITTLEBOO SALON",
                    'column_order' => 'contact_left',
            ],
        ];
    }
}
