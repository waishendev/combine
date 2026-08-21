<?php

return [
    // Explicit ownership policy. `is_system` means protected/built-in; it does
    // not by itself mean platform-global. Only these NULL Roles bypass Branches.
    'platform_global_role_names' => ['infra_core_x1'],

    'fresh_install_store_code' => env(
        'DEFAULT_STORE_LOCATION_CODE',
        env('MULTI_BRANCH_SEED_BRANCH_ONE_CODE', 'PNG'),
    ),

    /*
     * `migrate:fresh --seed` profile. Use "branch_one" when a delivery only
     * needs one Branch; "both" creates two isolated Branch admins and prepares
     * both Branches for QA. These values are fixture configuration, not runtime
     * Branch constants used by the application.
     */
    'fresh_seed_profile' => env('MULTI_BRANCH_SEED_PROFILE', 'both'),
    'fresh_seed_qa_data' => env('MULTI_BRANCH_SEED_QA_DATA', true),
    'fresh_seed_admin_password' => env('MULTI_BRANCH_SEED_ADMIN_PASSWORD', 'password'),
    'fresh_seed_shared_admin' => [
        'email' => env('MULTI_BRANCH_SEED_SHARED_ADMIN_EMAIL', 'branches.admin@example.com'),
        'username' => env('MULTI_BRANCH_SEED_SHARED_ADMIN_USERNAME', 'branchesadmin'),
    ],
    'fresh_seed_branches' => [
        'branch_one' => [
            'code' => env('MULTI_BRANCH_SEED_BRANCH_ONE_CODE', 'PNG'),
            'name' => env('MULTI_BRANCH_SEED_BRANCH_ONE_NAME', 'Gentlegurls Nail Salon'),
            'admin_email' => env('MULTI_BRANCH_SEED_BRANCH_ONE_ADMIN_EMAIL', 'branch1.admin@example.com'),
            'admin_username' => env('MULTI_BRANCH_SEED_BRANCH_ONE_ADMIN_USERNAME', 'branch1admin'),
        ],
        'branch_two' => [
            'code' => env('MULTI_BRANCH_SEED_BRANCH_TWO_CODE', 'BRANCH2'),
            'name' => env('MULTI_BRANCH_SEED_BRANCH_TWO_NAME', 'Gentlegurls QA Branch 2'),
            'admin_email' => env('MULTI_BRANCH_SEED_BRANCH_TWO_ADMIN_EMAIL', 'branch2.admin@example.com'),
            'admin_username' => env('MULTI_BRANCH_SEED_BRANCH_TWO_ADMIN_USERNAME', 'branch2admin'),
        ],
    ],
];
