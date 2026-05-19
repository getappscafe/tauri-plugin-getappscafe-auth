## Default Permission

Allows the full getapps.cafe activation flow:
- read hardware id / platform info
- start an activation and poll for its completion
- call /whoami with a bearer token
- read/write/remove the shared device token in the OS keychain
- read or initialize the grace-period state
- open the activation URL in the user's default browser

#### This default permission set includes the following:

- `allow-get_hardware_id`
- `allow-get_platform_info`
- `allow-init_activation`
- `allow-poll_activation`
- `allow-whoami`
- `allow-shared_token_get`
- `allow-shared_token_set`
- `allow-shared_token_remove`
- `allow-get_grace_state`
- `allow-open_activation_url`

## Permission Table

<table>
<tr>
<th>Identifier</th>
<th>Description</th>
</tr>


<tr>
<td>

`getappscafe-auth:allow-get_grace_state`

</td>
<td>

Allows the get_grace_state command without prearguments.

</td>
</tr>

<tr>
<td>

`getappscafe-auth:allow-get_hardware_id`

</td>
<td>

Allows the get_hardware_id command without prearguments.

</td>
</tr>

<tr>
<td>

`getappscafe-auth:allow-get_platform_info`

</td>
<td>

Allows the get_platform_info command without prearguments.

</td>
</tr>

<tr>
<td>

`getappscafe-auth:allow-init_activation`

</td>
<td>

Allows the init_activation command without prearguments.

</td>
</tr>

<tr>
<td>

`getappscafe-auth:allow-open_activation_url`

</td>
<td>

Allows the open_activation_url command without prearguments.

</td>
</tr>

<tr>
<td>

`getappscafe-auth:allow-poll_activation`

</td>
<td>

Allows the poll_activation command without prearguments.

</td>
</tr>

<tr>
<td>

`getappscafe-auth:allow-shared_token_get`

</td>
<td>

Allows the shared_token_get command without prearguments.

</td>
</tr>

<tr>
<td>

`getappscafe-auth:allow-shared_token_remove`

</td>
<td>

Allows the shared_token_remove command without prearguments.

</td>
</tr>

<tr>
<td>

`getappscafe-auth:allow-shared_token_set`

</td>
<td>

Allows the shared_token_set command without prearguments.

</td>
</tr>

<tr>
<td>

`getappscafe-auth:allow-whoami`

</td>
<td>

Allows the whoami command without prearguments.

</td>
</tr>

<tr>
<td>

`getappscafe-auth:deny-get_grace_state`

</td>
<td>

Denies the get_grace_state command without prearguments.

</td>
</tr>

<tr>
<td>

`getappscafe-auth:deny-get_hardware_id`

</td>
<td>

Denies the get_hardware_id command without prearguments.

</td>
</tr>

<tr>
<td>

`getappscafe-auth:deny-get_platform_info`

</td>
<td>

Denies the get_platform_info command without prearguments.

</td>
</tr>

<tr>
<td>

`getappscafe-auth:deny-init_activation`

</td>
<td>

Denies the init_activation command without prearguments.

</td>
</tr>

<tr>
<td>

`getappscafe-auth:deny-open_activation_url`

</td>
<td>

Denies the open_activation_url command without prearguments.

</td>
</tr>

<tr>
<td>

`getappscafe-auth:deny-poll_activation`

</td>
<td>

Denies the poll_activation command without prearguments.

</td>
</tr>

<tr>
<td>

`getappscafe-auth:deny-shared_token_get`

</td>
<td>

Denies the shared_token_get command without prearguments.

</td>
</tr>

<tr>
<td>

`getappscafe-auth:deny-shared_token_remove`

</td>
<td>

Denies the shared_token_remove command without prearguments.

</td>
</tr>

<tr>
<td>

`getappscafe-auth:deny-shared_token_set`

</td>
<td>

Denies the shared_token_set command without prearguments.

</td>
</tr>

<tr>
<td>

`getappscafe-auth:deny-whoami`

</td>
<td>

Denies the whoami command without prearguments.

</td>
</tr>

<tr>
<td>

`getappscafe-auth:allow-get-grace-state`

</td>
<td>

Enables the get_grace_state command without any pre-configured scope.

</td>
</tr>

<tr>
<td>

`getappscafe-auth:deny-get-grace-state`

</td>
<td>

Denies the get_grace_state command without any pre-configured scope.

</td>
</tr>

<tr>
<td>

`getappscafe-auth:allow-get-hardware-id`

</td>
<td>

Enables the get_hardware_id command without any pre-configured scope.

</td>
</tr>

<tr>
<td>

`getappscafe-auth:deny-get-hardware-id`

</td>
<td>

Denies the get_hardware_id command without any pre-configured scope.

</td>
</tr>

<tr>
<td>

`getappscafe-auth:allow-get-platform-info`

</td>
<td>

Enables the get_platform_info command without any pre-configured scope.

</td>
</tr>

<tr>
<td>

`getappscafe-auth:deny-get-platform-info`

</td>
<td>

Denies the get_platform_info command without any pre-configured scope.

</td>
</tr>

<tr>
<td>

`getappscafe-auth:allow-init-activation`

</td>
<td>

Enables the init_activation command without any pre-configured scope.

</td>
</tr>

<tr>
<td>

`getappscafe-auth:deny-init-activation`

</td>
<td>

Denies the init_activation command without any pre-configured scope.

</td>
</tr>

<tr>
<td>

`getappscafe-auth:allow-open-activation-url`

</td>
<td>

Enables the open_activation_url command without any pre-configured scope.

</td>
</tr>

<tr>
<td>

`getappscafe-auth:deny-open-activation-url`

</td>
<td>

Denies the open_activation_url command without any pre-configured scope.

</td>
</tr>

<tr>
<td>

`getappscafe-auth:allow-poll-activation`

</td>
<td>

Enables the poll_activation command without any pre-configured scope.

</td>
</tr>

<tr>
<td>

`getappscafe-auth:deny-poll-activation`

</td>
<td>

Denies the poll_activation command without any pre-configured scope.

</td>
</tr>

<tr>
<td>

`getappscafe-auth:allow-shared-token-get`

</td>
<td>

Enables the shared_token_get command without any pre-configured scope.

</td>
</tr>

<tr>
<td>

`getappscafe-auth:deny-shared-token-get`

</td>
<td>

Denies the shared_token_get command without any pre-configured scope.

</td>
</tr>

<tr>
<td>

`getappscafe-auth:allow-shared-token-remove`

</td>
<td>

Enables the shared_token_remove command without any pre-configured scope.

</td>
</tr>

<tr>
<td>

`getappscafe-auth:deny-shared-token-remove`

</td>
<td>

Denies the shared_token_remove command without any pre-configured scope.

</td>
</tr>

<tr>
<td>

`getappscafe-auth:allow-shared-token-set`

</td>
<td>

Enables the shared_token_set command without any pre-configured scope.

</td>
</tr>

<tr>
<td>

`getappscafe-auth:deny-shared-token-set`

</td>
<td>

Denies the shared_token_set command without any pre-configured scope.

</td>
</tr>

<tr>
<td>

`getappscafe-auth:allow-whoami`

</td>
<td>

Enables the whoami command without any pre-configured scope.

</td>
</tr>

<tr>
<td>

`getappscafe-auth:deny-whoami`

</td>
<td>

Denies the whoami command without any pre-configured scope.

</td>
</tr>
</table>
