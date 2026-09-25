<?php
/**
 * Stands in for Mashpia's \mashpia\api\auth\Auth, which the API calls for admin
 * login and for the parent site's mobile session.
 *
 *   admin login:     testadmin / secret                -> admin 1
 *   parent session:  mobile key "parent-token"         -> parent (admin) 501
 */
namespace mashpia\api\auth;

class Auth
{
    public static function login($username, $password)
    {
        return $username === 'testadmin' && $password === 'secret' ? ['id' => 1] : false;
    }

    public static function authenticate(array $credentials, string $type)
    {
        return $type === 'mobile' && ($credentials['key'] ?? '') === 'parent-token' ? '501' : false;
    }
}
